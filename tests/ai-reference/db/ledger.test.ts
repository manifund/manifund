// The ledger's database rules (docs/ai-reference/ledger/README.md): L2, L3, L4, L18. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { RUN } from '../helpers/content'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

const insertTxn = async (
  tx: Tx,
  from: string | null,
  to: string,
  amount = 10,
  type = 'profile donation'
) => {
  const [row] = await tx`insert into txns (from_id, to_id, amount, token, type)
                         values (${from}, ${to}, ${amount}, 'USD', ${type}) returning id`
  return row.id as string
}

describe('L2 the ledger is public', () => {
  test('visitors can read every txn', () =>
    inRollback(async (tx) => {
      const id = await insertTxn(tx, p.alice.id, p.bob.id)
      await actAsAnon(tx)
      expect(await tx`select amount from txns where id = ${id}`).toHaveLength(1)
    }))
  test("signed-in people can read txns they're not part of", () =>
    inRollback(async (tx) => {
      const id = await insertTxn(tx, p.alice.id, p.bob.id)
      await actAs(tx, p.rita.id)
      expect(await tx`select amount from txns where id = ${id}`).toHaveLength(1)
    }))
})

describe('L3 only server code writes the ledger', () => {
  test('a signed-in person adding a txn, even to themselves, is refused', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.bob.id)
      await expect(insertTxn(tx, p.alice.id, p.bob.id, 1000)).rejects.toThrow('row-level security')
    }))
  test('a visitor adding a txn is refused', () =>
    inRollback(async (tx) => {
      await actAsAnon(tx)
      await expect(insertTxn(tx, p.alice.id, p.bob.id, 1000)).rejects.toThrow('row-level security')
    }))
  test('nobody changes or deletes txns through the database API', () =>
    inRollback(async (tx) => {
      const id = await insertTxn(tx, p.bob.id, p.alice.id, 10)
      await actAs(tx, p.bob.id) // the sender
      expect(await tx`update txns set amount = 0 where id = ${id} returning id`).toHaveLength(0)
      expect(await tx`delete from txns where id = ${id} returning id`).toHaveLength(0)
      await actAsAnon(tx)
      expect(await tx`update txns set amount = 0 where id = ${id} returning id`).toHaveLength(0)
      expect(await tx`delete from txns where id = ${id} returning id`).toHaveLength(0)
      await tx`reset role`
      const [row] = await tx`select amount from txns where id = ${id}`
      expect(Number(row.amount)).toBe(10)
    }))
})

describe('L4 a profile in the ledger cannot be deleted', () => {
  const makeProfile = async (tx: Tx, name: string) => {
    const [row] =
      await tx`insert into profiles (id, username) values (gen_random_uuid(), ${`${RUN}-${name}`}) returning id`
    return row.id as string
  }
  test('as recipient or as sender', () =>
    inRollback(async (tx) => {
      const recipient = await makeProfile(tx, 'recipient')
      const sender = await makeProfile(tx, 'sender')
      await insertTxn(tx, p.alice.id, recipient)
      await insertTxn(tx, sender, p.alice.id)
      // Each refused delete in its own savepoint, so the transaction goes on after the first error.
      const refusal = (id: string) =>
        (tx as any).savepoint(async (sp: Tx) => {
          await sp`delete from profiles where id = ${id}`
        })
      await expect(refusal(recipient)).rejects.toThrow('txns_to_id_fkey')
      await expect(refusal(sender)).rejects.toThrow('txns_from_id_fkey')
    }))
  test('a profile with no txns can be (the check is about the ledger)', () =>
    inRollback(async (tx) => {
      const id = await makeProfile(tx, 'no-money')
      expect(await tx`delete from profiles where id = ${id} returning id`).toHaveLength(1)
    }))
})

describe('L18 handing a project over to the person who signed up', () => {
  test('the project changes creator, the transfer is marked done, and no money moves', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.rita.id, 'proposal')
      const [transfer] =
        await tx`insert into project_transfers (recipient_email, recipient_name, project_id)
                                  values (${`${RUN}-new@local.test`}, 'New person', ${project.id}) returning id`
      const [{ count: before }] = await tx`select count(*)::int from txns`
      await tx`select _transfer_project(project_id => ${project.id}::uuid, to_id => ${p.bob.id}::uuid,
                                        transfer_id => ${transfer.id}::uuid)`
      const [proj] = await tx`select creator, stage from projects where id = ${project.id}`
      expect(proj.creator).toBe(p.bob.id)
      expect(proj.stage).toBe('proposal')
      const [t] = await tx`select transferred from project_transfers where id = ${transfer.id}`
      expect(t.transferred).toBe(true)
      const [{ count: after }] = await tx`select count(*)::int from txns`
      expect(after).toBe(before)
    }))
})
