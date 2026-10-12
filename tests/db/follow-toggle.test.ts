// The project page's Follow / Unfollow button (toggle_follow, unfollow_project) must change only the one project's
// follow for the one person. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(
    import.meta.dir,
    '../../supabase/migrations/20261012151233_follow_toggle_matches_one_project.sql'
  ),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

// Three projects bob follows, one rita follows too; returns their ids.
async function setUp(tx: Tx) {
  if (!process.env.FOLLOW_TOGGLE_OLD) await tx.unsafe(migration)
  const ids: string[] = []
  for (const n of [1, 2, 3])
    ids.push((await makeProject(tx, p.alice.id, 'active', `follow-toggle-${n}-${Date.now()}`)).id)
  for (const id of ids)
    await tx`insert into project_follows (project_id, follower_id) values (${id}, ${p.bob.id})`
  await tx`insert into project_follows (project_id, follower_id) values (${ids[0]}, ${p.rita.id})`
  return ids
}

async function followsOf(tx: Tx, ids: string[]) {
  await tx`reset role`
  const rows = await tx`
    select project_id, follower_id from project_follows where project_id in ${tx(ids)}
    order by follower_id, project_id`
  return rows.map(
    (r: { project_id: string; follower_id: string }) => `${r.follower_id}:${r.project_id}`
  )
}

describe('the Follow / Unfollow button', () => {
  test('toggling one project unfollows only that one, toggling again follows it back', () =>
    inRollback(async (tx) => {
      const ids = await setUp(tx)
      const before = await followsOf(tx, ids)
      await actAs(tx, p.bob.id)
      await tx`select toggle_follow(${ids[1]}, ${p.bob.id})`
      expect(await followsOf(tx, ids)).toEqual(before.filter((f) => f !== `${p.bob.id}:${ids[1]}`))
      await actAs(tx, p.bob.id)
      await tx`select toggle_follow(${ids[1]}, ${p.bob.id})`
      expect(await followsOf(tx, ids)).toEqual(before)
    }))

  test('unfollowing removes only that project for that person', () =>
    inRollback(async (tx) => {
      const ids = await setUp(tx)
      const before = await followsOf(tx, ids)
      await actAs(tx, p.bob.id)
      await tx`select unfollow_project(${ids[0]}, ${p.bob.id})`
      expect(await followsOf(tx, ids)).toEqual(before.filter((f) => f !== `${p.bob.id}:${ids[0]}`))
    }))
})
