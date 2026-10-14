// F2 at the database: each person's browser reads only their own follows and saved searches, and writes none; the
// profile shows everyone's through server code (db/following.ts).
// The network line's data (F8) comes from network_activity(), which reads the caller's own follows.
import { beforeAll, describe, expect, test } from 'bun:test'
import { actAs, inRollback, insertComment } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'
import { RUN } from '../helpers/content'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

async function refused(query: PromiseLike<unknown>, message: string) {
  let error: unknown
  try {
    await query
  } catch (e) {
    error = e
  }
  expect(error instanceof Error ? error.message : String(error)).toContain(message)
}

describe('F2 browsers read only their own follows and saved searches; only server code writes them', () => {
  test('a follow is visible to the follower only', () =>
    inRollback(async (tx) => {
      await tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.bob.id})`
      await tx`insert into saved_searches (owner_id, name, query) values (${p.alice.id}, 'AI safety', 'cause=x')`
      await actAs(tx, p.bob.id)
      expect(
        await tx`select 1 from profile_follows where follower_id = ${p.alice.id}`
      ).toHaveLength(0)
      expect(await tx`select 1 from saved_searches where owner_id = ${p.alice.id}`).toHaveLength(0)
      await actAs(tx, p.alice.id)
      expect(await tx`select followed_id from profile_follows`).toEqual([{ followed_id: p.bob.id }])
      expect(await tx`select name from saved_searches`).toHaveLength(1)
    }))
  test('signed-in people cannot write follows or saved searches directly', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.alice.id)
      await refused(
        tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.bob.id})`,
        'row-level security'
      )
    }))
  test('nobody follows themselves', () =>
    inRollback(async (tx) => {
      await refused(
        tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.alice.id})`,
        'profile_follows_not_self'
      )
    }))
})

describe('F8 network_activity(): what the people you follow did, by project', () => {
  test("a followed person's project, comment and donation; nothing for someone who follows nobody", () =>
    inRollback(async (tx) => {
      await tx`delete from profile_follows where follower_id in (${p.alice.id}, ${p.rita.id})`
      await tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.bob.id})`
      const own = await makeProject(tx, p.bob.id, 'proposal', `${RUN}-net-own`)
      const other = await makeProject(tx, p.rita.id, 'active', `${RUN}-net-other`)
      const draft = await makeProject(tx, p.bob.id, 'draft', `${RUN}-net-draft`)
      await insertComment(tx, { by: p.bob.id, project: other.id, text: `Nice ${RUN}` })
      await tx`insert into txns (from_id, to_id, amount, token, project, type)
               values (${p.bob.id}, ${p.rita.id}, 50, 'USD', ${other.id}, 'project donation')`
      await actAs(tx, p.alice.id)
      const rows = await tx`select project_id, kind from network_activity()`
      const kinds = (id: string) =>
        rows
          .filter((r) => r.project_id === id)
          .map((r) => r.kind)
          .sort()
      expect(kinds(own.id)).toEqual(['created'])
      expect(kinds(other.id)).toEqual(['commented', 'donated'])
      expect(kinds(draft.id)).toEqual([])
      await actAs(tx, p.rita.id)
      expect(await tx`select 1 from network_activity()`).toHaveLength(0)
    }))
})
