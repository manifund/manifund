// Following a project twice: upvotes, donations, offers and trades all call follow_project after they're saved,
// so it must accept someone who already follows. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(import.meta.dir, '../../supabase/migrations/20261009140000_follow_project_idempotent.sql'),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

describe('following a project you already follow', () => {
  test('does not fail and keeps one follow', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id)
      await actAs(tx, p.bob.id)
      await tx`select follow_project(${project.id}, ${p.bob.id})`
      await tx`select follow_project(${project.id}, ${p.bob.id})`
      await tx`reset role`
      const follows =
        await tx`select follower_id from project_follows where project_id = ${project.id}`
      expect(follows.map((r: { follower_id: string }) => r.follower_id)).toEqual([p.bob.id])
    }))
})
