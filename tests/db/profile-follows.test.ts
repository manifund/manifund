// F2 at the database, as for project_follows: anyone reads follows and saved searches, people add and remove only
// their own, nobody edits them.
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

describe('F2 follows and saved searches are public; people write only their own', () => {
  test('anyone reads them', () =>
    inRollback(async (tx) => {
      await tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.bob.id})`
      await tx`insert into saved_searches (owner_id, name, query) values (${p.alice.id}, 'AI safety', 'cause=x')`
      await actAs(tx, p.rita.id)
      expect(
        await tx`select followed_id from profile_follows where follower_id = ${p.alice.id}`
      ).toEqual([{ followed_id: p.bob.id }])
      expect(await tx`select name from saved_searches where owner_id = ${p.alice.id}`).toEqual([
        { name: 'AI safety' },
      ])
    }))
  test('people add and remove their own', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.alice.id)
      await tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.bob.id})`
      await tx`insert into saved_searches (owner_id, name, query) values (${p.alice.id}, 'Mine', 'q=mine')`
      expect(
        await tx`delete from profile_follows where follower_id = ${p.alice.id} and followed_id = ${p.bob.id} returning 1`
      ).toHaveLength(1)
      expect(
        await tx`delete from saved_searches where owner_id = ${p.alice.id} and name = 'Mine' returning 1`
      ).toHaveLength(1)
    }))
  // one refused write per transaction: an error aborts the rest of it
  test('nobody adds a follow for someone else', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.rita.id)
      await refused(
        tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.rita.id})`,
        'row-level security'
      )
    }))
  test('nobody saves a search for someone else', () =>
    inRollback(async (tx) => {
      await actAs(tx, p.rita.id)
      await refused(
        tx`insert into saved_searches (owner_id, name, query) values (${p.alice.id}, 'X', 'q=x')`,
        'row-level security'
      )
    }))
  test("nobody removes or edits someone else's", () =>
    inRollback(async (tx) => {
      await tx`insert into profile_follows (follower_id, followed_id) values (${p.alice.id}, ${p.bob.id})`
      await tx`insert into saved_searches (owner_id, name, query) values (${p.alice.id}, 'Theirs', 'q=theirs')`
      await actAs(tx, p.rita.id)
      expect(
        await tx`delete from profile_follows where follower_id = ${p.alice.id} returning 1`
      ).toHaveLength(0)
      expect(
        await tx`delete from saved_searches where owner_id = ${p.alice.id} returning 1`
      ).toHaveLength(0)
      expect(
        await tx`update saved_searches set name = 'Edited' where owner_id = ${p.alice.id} returning 1`
      ).toHaveLength(0)
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
