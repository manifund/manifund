// Admin tools' database side (docs/ai-reference/admin/README.md). Only throwaway rows inside a rolled-back transaction.
import { describe, expect, test } from 'bun:test'
import { inRollback, type Tx } from '../helpers/db'

// Bun's tagged queries are lazy: start them inside an async function so expect(...).rejects doesn't hang the
// transaction (see tests/ai-reference/db/people.test.ts in the people area).
const run = (query: PromiseLike<unknown>) => (async () => await query)()

async function makeProfile(tx: Tx) {
  const id = crypto.randomUUID()
  await tx`insert into profiles (id, username, full_name) values (${id}, ${'adm' + id.slice(0, 8)}, 'Test admin tools')`
  return id
}

async function makeProposal(tx: Tx, creator: string) {
  const [row] = await tx`
    insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares, round)
    values ('Test alerts', 'test', ${creator}, ${'adm-' + crypto.randomUUID().slice(0, 8)}, 'proposal', 'grant', 100, 1000,
            10000000, 'Regrants')
    returning id, alerts_paused`
  return row as { id: string; alerts_paused: boolean }
}

describe('M11 a project’s approval reminders: on unless an admin pauses them', () => {
  test('a new project starts unpaused', () =>
    inRollback(async (tx) => {
      const project = await makeProposal(tx, await makeProfile(tx))
      expect(project.alerts_paused).toBe(false)
    }))
  test('paused or not, never unknown', () =>
    inRollback(async (tx) => {
      const project = await makeProposal(tx, await makeProfile(tx))
      await tx`update projects set alerts_paused = true where id = ${project.id}`
      expect(
        (await tx`select alerts_paused from projects where id = ${project.id}`)[0].alerts_paused
      ).toBe(true)
      await expect(
        run(tx`update projects set alerts_paused = null where id = ${project.id}`)
      ).rejects.toThrow(/null value|not-null/)
    }))
})
