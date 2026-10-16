// Dormant features in the database (docs/ai-reference/dormant/README.md): grant evaluations and trust rows are public to
// read and written only by their author (X12). Each test runs in a rolled-back transaction.
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

// Bun's tagged queries are lazy: wrap one in an async function so `rejects` sees it run.
const run = (q: () => Promise<unknown>) => (async () => await q())()

async function evaluation(tx: Tx, by: string, project: string, score = 3) {
  await tx`insert into project_evals (project_id, evaluator_id, score, confidence)
           values (${project}, ${by}, ${score}, 0.5)`
}
async function trust(tx: Tx, by: string, of: string, weight = 1) {
  await tx`insert into profile_trust (truster_id, trusted_id, weight) values (${by}, ${of}, ${weight})`
}

describe('X12 evaluations and trust rows: anyone reads them, only their author writes them', () => {
  test('visitors and other people read them', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.rita.id)
      await evaluation(tx, p.alice.id, project.id)
      await trust(tx, p.alice.id, p.bob.id)
      await actAsAnon(tx)
      expect(await tx`select 1 from project_evals where project_id = ${project.id}`).toHaveLength(1)
      expect(
        await tx`select 1 from profile_trust where truster_id = ${p.alice.id} and trusted_id = ${p.bob.id}`
      ).toHaveLength(1)
      await actAs(tx, p.bob.id)
      expect(await tx`select 1 from project_evals where project_id = ${project.id}`).toHaveLength(1)
    }))

  test('a signed-in person adds, changes and deletes their own', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.rita.id)
      await actAs(tx, p.alice.id)
      await evaluation(tx, p.alice.id, project.id)
      await trust(tx, p.alice.id, p.bob.id)
      const changed = await tx`update project_evals set score = 1
                               where project_id = ${project.id} and evaluator_id = ${p.alice.id} returning score`
      expect(changed).toEqual([{ score: 1 }])
      expect(
        await tx`update profile_trust set weight = 2 where truster_id = ${p.alice.id} returning weight`
      ).toHaveLength(1)
      expect(
        await tx`delete from project_evals where project_id = ${project.id} returning 1`
      ).toHaveLength(1)
      expect(await tx`delete from profile_trust where truster_id = ${p.alice.id} returning 1`).toHaveLength(1)
    }))

  test('nobody adds one in someone else’s name', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.rita.id)
      await actAs(tx, p.bob.id)
      await expect(run(() => evaluation(tx, p.alice.id, project.id))).rejects.toThrow('row-level security')
    }))
  test('nobody trusts in someone else’s name', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.bob.id)
      await expect(run(() => trust(tx, p.alice.id, p.rita.id))).rejects.toThrow('row-level security')
    }))
  test('visitors add nothing', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.rita.id)
      await actAsAnon(tx)
      await expect(run(() => evaluation(tx, p.alice.id, project.id))).rejects.toThrow('row-level security')
    }))

  test('nobody else changes or deletes them, signed in or not', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.rita.id)
      await evaluation(tx, p.alice.id, project.id)
      await trust(tx, p.alice.id, p.bob.id)
      // Saving the form deletes the evaluations of projects put back in "unsorted" by project id alone
      // (pages/api/save-evals.ts); only the author's own rows may go.
      for (const who of ['bob', 'anon'] as const) {
        if (who === 'anon') await actAsAnon(tx)
        else await actAs(tx, p.bob.id)
        expect(
          await tx`update project_evals set score = 1 where project_id = ${project.id} returning 1`
        ).toHaveLength(0)
        expect(
          await tx`delete from project_evals where project_id = ${project.id} returning 1`
        ).toHaveLength(0)
        expect(
          await tx`update profile_trust set weight = 0 where truster_id = ${p.alice.id} returning 1`
        ).toHaveLength(0)
        expect(
          await tx`delete from profile_trust where truster_id = ${p.alice.id} returning 1`
        ).toHaveLength(0)
      }
    }))
})
