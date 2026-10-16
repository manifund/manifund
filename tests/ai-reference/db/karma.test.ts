// Karma's storage and who can write it (docs/ai-reference/karma/README.md, K1, K7-K9). Only throwaway rows inside a
// rolled-back transaction. Needs the karma migrations (20261008000000_add_karma.sql, 20261008010000_adjust_karma.sql)
// in the local database.
import { describe, expect, test } from 'bun:test'
import { actAs, actAsAnon, inRollback, type Tx } from '../helpers/db'

// Bun's tagged queries are lazy: start them inside an async function so expect(...).rejects doesn't hang the
// transaction (see tests/ai-reference/db/people.test.ts).
const run = (query: PromiseLike<unknown>) => (async () => await query)()
async function refused(tx: Tx, query: () => PromiseLike<unknown>, message: RegExp) {
  await tx`savepoint s`
  await expect(run(query())).rejects.toThrow(message)
  await tx`rollback to savepoint s`
}

async function makeProfile(tx: Tx) {
  const id = crypto.randomUUID()
  await tx`insert into profiles (id, username, full_name) values (${id}, ${'karma' + id.slice(0, 8)}, 'Test karma')`
  return id
}
async function makeProject(tx: Tx, creator: string) {
  const [row] = await tx`
    insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares, round)
    values ('Test karma', 'test', ${creator}, ${'karma-' + crypto.randomUUID().slice(0, 8)}, 'proposal', 'grant', 100,
            1000, 10000000, 'Regrants')
    returning id`
  return row.id as string
}
const karmaOf = async (tx: Tx, table: 'profiles' | 'projects', id: string) => {
  const [row] = await tx`select karma, karma_breakdown, karma_updated_at from ${tx(table)} where id = ${id}`
  return row as { karma: number; karma_breakdown: unknown; karma_updated_at: Date | null }
}
const asServer = (tx: Tx) => tx`set local role service_role`

describe('K1 every profile and project stores karma, its parts and when it was computed', () => {
  test('a new profile and project start at 0, not yet computed', () =>
    inRollback(async (tx) => {
      const creator = await makeProfile(tx)
      const project = await makeProject(tx, creator)
      for (const [table, id] of [['profiles', creator], ['projects', project]] as const) {
        const row = await karmaOf(tx, table, id)
        expect(row.karma).toBe(0)
        expect(row.karma_breakdown).toBeNull()
        expect(row.karma_updated_at).toBeNull()
      }
    }))
})

describe('K7 a recompute writes every row it is given, with its parts and the time', () => {
  test('apply_karma, as the server', () =>
    inRollback(async (tx) => {
      const creator = await makeProfile(tx)
      const other = await makeProfile(tx)
      const project = await makeProject(tx, creator)
      await asServer(tx)
      const profiles = [{ id: creator, karma: 42.5, breakdown: { starting: 10 } }]
      const projects = [{ id: project, karma: 7, breakdown: { base: 2 } }]
      await tx`select apply_karma(${profiles}::jsonb, ${projects}::jsonb)`
      const p = await karmaOf(tx, 'profiles', creator)
      expect(p.karma).toBe(42.5)
      expect(p.karma_breakdown).toEqual({ starting: 10 })
      expect(p.karma_updated_at).not.toBeNull()
      expect((await karmaOf(tx, 'projects', project)).karma).toBe(7)
      expect((await karmaOf(tx, 'profiles', other)).karma_updated_at).toBeNull()
    }))
})

describe('K8 a vote nudges the project\'s and its creator\'s karma', () => {
  test('adjust_karma adds the deltas, as the server', () =>
    inRollback(async (tx) => {
      const creator = await makeProfile(tx)
      const project = await makeProject(tx, creator)
      await asServer(tx)
      await tx`select adjust_karma(${project}::uuid, 2, ${creator}::uuid, 2)`
      await tx`select adjust_karma(${project}::uuid, -0.5, ${creator}::uuid, -0.5)`
      expect((await karmaOf(tx, 'projects', project)).karma).toBe(1.5)
      expect((await karmaOf(tx, 'profiles', creator)).karma).toBe(1.5)
    }))
})

describe('K9 karma and scores are written by the server', () => {
  test('visitors and signed-in people can\'t call the functions that write it', () =>
    inRollback(async (tx) => {
      const me = await makeProfile(tx)
      const project = await makeProject(tx, me)
      await actAs(tx, me)
      await refused(tx, () => tx`select adjust_karma(${project}::uuid, 100, ${me}::uuid, 100)`, /permission denied/)
      await refused(tx, () => tx`select apply_karma('[]'::jsonb, '[]'::jsonb)`, /permission denied/)
      await actAsAnon(tx)
      await refused(tx, () => tx`select adjust_karma(${project}::uuid, 100, ${me}::uuid, 100)`, /permission denied/)
      await refused(tx, () => tx`select apply_karma('[]'::jsonb, '[]'::jsonb)`, /permission denied/)
    }))
  test('the server can set karma and scores when it creates a project', () =>
    inRollback(async (tx) => {
      const me = await makeProfile(tx)
      const id = crypto.randomUUID()
      await asServer(tx)
      await tx`
        insert into projects (id, title, blurb, creator, slug, stage, type, min_funding, funding_goal, founder_shares,
                              round, karma, karma_breakdown, quality_score)
        values (${id}, 'Test karma', 'test', ${me}, ${'karma-' + id.slice(0, 8)}, 'proposal', 'grant', 100, 1000,
                10000000, 'Regrants', 7, '{"base": 7}', 3)`
      const row = await karmaOf(tx, 'projects', id)
      expect(row.karma).toBe(7)
      expect(row.karma_breakdown).toEqual({ base: 7 })
      const [{ quality_score }] = await tx`select quality_score from projects where id = ${id}`
      expect(Number(quality_score)).toBe(3)
    }))
  test('changing one\'s own profile leaves its karma, parts and time as they were', () =>
    inRollback(async (tx) => {
      const me = await makeProfile(tx)
      await actAs(tx, me)
      await tx`update profiles set karma = 9999, karma_breakdown = '{"votes": 9999}', karma_updated_at = now(),
               bio = 'still mine to edit' where id = ${me}`
      await tx`reset role`
      const row = await karmaOf(tx, 'profiles', me)
      expect(row.karma).toBe(0)
      expect(row.karma_breakdown).toBeNull()
      expect(row.karma_updated_at).toBeNull()
      const [{ bio }] = await tx`select bio from profiles where id = ${me}`
      expect(bio).toBe('still mine to edit')
    }))
  test('a creator changing their own project leaves its karma as it was; the server can change it', () =>
    inRollback(async (tx) => {
      const me = await makeProfile(tx)
      const project = await makeProject(tx, me)
      await actAs(tx, me)
      await tx`update projects set karma = 9999, blurb = 'new blurb' where id = ${project}`
      await tx`reset role`
      expect((await karmaOf(tx, 'projects', project)).karma).toBe(0)
      const [{ blurb }] = await tx`select blurb from projects where id = ${project}`
      expect(blurb).toBe('new blurb')
      await asServer(tx)
      await tx`update projects set karma = 5 where id = ${project}`
      expect((await karmaOf(tx, 'projects', project)).karma).toBe(5)
    }))
})
