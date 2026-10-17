// Deposits and withdrawals, what the database guarantees: docs/ai-reference/deposits-withdrawals/README.md, rules W7,
// W10, W16, W18. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, sql, type Tx } from '../helpers/db'
import { getPeople, type People } from '../helpers/fixtures'

let p: People
let BANK: string // Manifund's bank account, the other side of deposits and withdrawals
beforeAll(async () => {
  p = await getPeople()
  ;[{ id: BANK }] = await sql`select id from profiles where username = 'Manifund-Bank'`
})

const withdrawTxn = async (tx: Tx, from: string, amount = 1500) => {
  const [row] = await tx`insert into txns (from_id, to_id, amount, token, type)
                         values (${from}, ${BANK}, ${amount}, 'USD', 'withdraw') returning id`
  return row.id as string
}
const request = async (
  tx: Tx,
  r: { profile: string; status?: string; amount?: number; method?: string; txn?: string | null }
) => {
  const [row] = await tx`
    insert into withdrawal_requests (profile_id, amount, payment_method, status, txn_id)
    values (${r.profile}, ${r.amount ?? 1500}, ${r.method ?? 'ach'}, ${r.status ?? 'awaiting_recipient'}, ${r.txn ?? null})
    returning id`
  return row.id as string
}
// Each expected refusal in its own savepoint, so the transaction goes on after it.
const refused = async (tx: Tx, fn: (sp: Tx) => Promise<unknown>) => {
  let error: unknown
  try {
    await (tx as any).savepoint(async (sp: Tx) => {
      await fn(sp)
    })
  } catch (e) {
    error = e
  }
  return error
}

describe('W16 one open Mercury withdrawal per person', () => {
  test('a second open request is refused, whatever the open status', () =>
    inRollback(async (tx) => {
      for (const open of [
        'awaiting_recipient',
        'ready_to_pay',
        'pending_approval',
        'needs_manual',
      ]) {
        await (tx as any)
          .savepoint(async (sp: Tx) => {
            await request(sp, { profile: p.bob.id, status: open })
            const e = await refused(sp, (s) =>
              request(s, { profile: p.bob.id, status: 'awaiting_recipient' })
            )
            expect(String(e)).toContain('withdrawal_requests_one_active_per_profile')
            throw new Error('undo') // roll this round back
          })
          .catch((e: unknown) => {
            if (String(e) !== 'Error: undo') throw e
          })
      }
    }))
  test('finished requests (sent, failed, rejected) do not count', () =>
    inRollback(async (tx) => {
      await request(tx, { profile: p.bob.id, status: 'sent' })
      await request(tx, { profile: p.bob.id, status: 'failed' })
      await request(tx, { profile: p.bob.id, status: 'rejected' })
      await request(tx, { profile: p.bob.id, status: 'awaiting_recipient' })
      expect(
        await tx`select 1 from withdrawal_requests where profile_id = ${p.bob.id} and status = 'awaiting_recipient'`
      ).toHaveLength(1)
    }))
  test("another person's open request doesn't block", () =>
    inRollback(async (tx) => {
      await request(tx, { profile: p.alice.id })
      await request(tx, { profile: p.bob.id })
    }))
  test('a request is for a positive amount, by ACH or international wire, in a known status', () =>
    inRollback(async (tx) => {
      expect(
        String(await refused(tx, (s) => request(s, { profile: p.bob.id, amount: 0 })))
      ).toContain('amount_check')
      expect(
        String(await refused(tx, (s) => request(s, { profile: p.bob.id, method: 'paypal' })))
      ).toContain('payment_method_check')
      expect(
        String(await refused(tx, (s) => request(s, { profile: p.bob.id, status: 'paid' })))
      ).toContain('status_check')
    }))
})

describe('W10 giving the money back deletes the withdraw txn; the request stays as a record', () => {
  test('deleting the reserving txn empties the link, and the request keeps its status and reason', () =>
    inRollback(async (tx) => {
      const txn = await withdrawTxn(tx, p.bob.id)
      const id = await request(tx, { profile: p.bob.id, status: 'pending_approval', txn })
      await tx`update withdrawal_requests set status = 'rejected', failure_reason = 'payment rejected in Mercury' where id = ${id}`
      await tx`delete from txns where id = ${txn}`
      const [row] =
        await tx`select status, txn_id, failure_reason, amount from withdrawal_requests where id = ${id}`
      expect(row.txn_id).toBeNull()
      expect(row.status).toBe('rejected')
      expect(row.failure_reason).toBe('payment rejected in Mercury')
      expect(Number(row.amount)).toBe(1500)
    }))
})

describe('W18 people read only their own withdrawal requests and write none', () => {
  test('the owner reads theirs; others and visitors see nothing', () =>
    inRollback(async (tx) => {
      const id = await request(tx, { profile: p.bob.id })
      await actAs(tx, p.bob.id)
      expect(await tx`select id from withdrawal_requests where id = ${id}`).toHaveLength(1)
      await actAs(tx, p.alice.id)
      expect(await tx`select id from withdrawal_requests where id = ${id}`).toHaveLength(0)
      await actAsAnon(tx)
      expect(await tx`select id from withdrawal_requests where id = ${id}`).toHaveLength(0)
    }))
  test('a signed-in person creating a request for themselves is refused', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.bob.id)
      expect(String(await refused(tx, (s) => request(s, { profile: p.bob.id })))).toContain(
        'row-level security'
      )
    }))
  test('the owner can neither change nor delete their request', () =>
    inRollback(async (tx) => {
      const id = await request(tx, { profile: p.bob.id, status: 'pending_approval' })
      await actAs(tx, p.bob.id)
      expect(
        await tx`update withdrawal_requests set status = 'sent' where id = ${id} returning id`
      ).toHaveLength(0)
      expect(await tx`delete from withdrawal_requests where id = ${id} returning id`).toHaveLength(
        0
      )
      await tx`reset role`
      const [row] = await tx`select status from withdrawal_requests where id = ${id}`
      expect(row.status).toBe('pending_approval')
    }))
})

describe('W7 Stripe records are private to the server', () => {
  const stripeRow = async (tx: Tx) => {
    const [t] = await tx`insert into txns (from_id, to_id, amount, token, type)
                         values (${BANK}, ${p.bob.id}, 25, 'USD', 'deposit') returning id`
    const [row] = await tx`insert into stripe_txns (session_id, customer_id, txn_id, amount)
                           values ('cs_test_local', ${p.bob.id}, ${t.id}, 25) returning id, txn_id`
    return row as { id: string; txn_id: string }
  }
  test('not readable by the person it is about, other people or visitors', () =>
    inRollback(async (tx) => {
      const row = await stripeRow(tx)
      for (const who of [p.bob.id, p.alice.id]) {
        await actAs(tx, who)
        expect(await tx`select id from stripe_txns where id = ${row.id}`).toHaveLength(0)
      }
      await actAsAnon(tx)
      expect(await tx`select id from stripe_txns where id = ${row.id}`).toHaveLength(0)
    }))
  test('browsers can add, change or delete none', () =>
    inRollback(async (tx) => {
      const row = await stripeRow(tx)
      await actAs(tx, p.bob.id)
      const e = await refused(
        tx,
        (s) => s`insert into stripe_txns (session_id, customer_id, txn_id, amount)
                                          values ('cs_forged', ${p.bob.id}, ${row.txn_id}, 1000)`
      )
      expect(String(e)).toContain('row-level security')
      expect(
        await tx`update stripe_txns set amount = 1000 where id = ${row.id} returning id`
      ).toHaveLength(0)
      expect(await tx`delete from stripe_txns where id = ${row.id} returning id`).toHaveLength(0)
      await actAsAnon(tx)
      expect(
        String(
          await refused(
            tx,
            (s) => s`insert into stripe_txns (session_id, customer_id, txn_id, amount)
                                          values ('cs_forged', ${p.bob.id}, ${row.txn_id}, 1000)`
          )
        )
      ).toContain('row-level security')
    }))
})
