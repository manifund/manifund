// The Stripe webhook credits a paid checkout session through credit_stripe_checkout: once per session, all or
// nothing, callable only by the server. Always rolled back. Two deliveries at the same time need two connections,
// so that case is checked against the webhook route instead (see the PR).
import { beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(import.meta.dir, '../../supabase/migrations/20261012192102_credit_stripe_checkout_once.sql'),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

async function credit(tx: Tx, sessionId: string, passFundsTo: string | null = null) {
  const [row] = await tx`
    select credit_stripe_checkout(${sessionId}, ${p.bob.id}, 25, ${p.rita.id}, ${randomUUID()}, ${passFundsTo})
      as credited`
  return row.credited as boolean
}

async function recorded(tx: Tx, sessionId: string) {
  const stripe = await tx`select txn_id, amount from stripe_txns where session_id = ${sessionId}`
  const txns = stripe.length
    ? await tx`select type, amount, from_id, to_id from txns where id in ${tx(stripe.map((r: { txn_id: string }) => r.txn_id))}`
    : []
  return { stripe, txns }
}

describe('crediting a Stripe checkout session', () => {
  test('a second delivery of the same session credits nothing', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const sessionId = `cs_test_${randomUUID()}`
      expect(await credit(tx, sessionId)).toBe(true)
      expect(await credit(tx, sessionId)).toBe(false)
      const { stripe, txns } = await recorded(tx, sessionId)
      expect(stripe.length).toBe(1)
      expect(txns).toEqual([{ type: 'deposit', amount: '25', from_id: p.rita.id, to_id: p.bob.id }])
    }))

  test('a deposit passed on to a profile also records the donation', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const sessionId = `cs_test_${randomUUID()}`
      const donations = async () =>
        (
          await tx`
            select count(*)::int as n from txns
            where to_id = ${p.alice.id} and from_id = ${p.bob.id} and type = 'profile donation' and amount = 25`
        )[0].n as number
      const before = await donations()
      expect(await credit(tx, sessionId, p.alice.id)).toBe(true)
      const after = await donations()
      expect(after - before).toBe(1)
    }))

  test('if any part fails, nothing is recorded, so a later delivery can retry', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const sessionId = `cs_test_${randomUUID()}`
      // The donation onward fails (no such profile): the deposit and its record must not stay behind.
      await expect(
        tx.savepoint(async (sp: Tx) => credit(sp, sessionId, randomUUID()))
      ).rejects.toThrow()
      expect((await recorded(tx, sessionId)).stripe.length).toBe(0)
      expect(await credit(tx, sessionId)).toBe(true)
    }))

  test('signed-in people and visitors cannot call it', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await actAs(tx, p.bob.id)
      await expect(
        tx.savepoint(async (sp: Tx) => credit(sp, `cs_test_${randomUUID()}`))
      ).rejects.toThrow(/permission denied/)
      await actAsAnon(tx)
      await expect(
        tx.savepoint(async (sp: Tx) => credit(sp, `cs_test_${randomUUID()}`))
      ).rejects.toThrow(/permission denied/)
    }))
})
