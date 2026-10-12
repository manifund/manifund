// Only the server sets a project's approval, signed agreement, type and creator; creators keep editing
// the rest. Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, inRollback, type Tx } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

const migration = readFileSync(
  join(
    import.meta.dir,
    '../../supabase/migrations/20261012191625_project_approval_server_only.sql'
  ),
  'utf8'
)

let p: People
beforeAll(async () => {
  p = await getPeople()
})

async function row(tx: Tx, id: string) {
  await tx`reset role`
  const [r] =
    await tx`select approved, signed_agreement, type, creator, title from projects where id = ${id}`
  return r
}

describe('project approval is set by the server only', () => {
  test("a creator's update keeps approval, agreement, type and creator, and saves the rest", () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await actAs(tx, p.alice.id)
      await tx`update projects set approved = true, signed_agreement = true, type = 'cert',
                 creator = ${p.bob.id}, title = 'New title' where id = ${project.id}`
      const r = await row(tx, project.id)
      expect(r.approved).toBeNull()
      expect(r.signed_agreement).toBe(false)
      expect(r.type).toBe('grant')
      expect(r.creator).toBe(p.alice.id)
      expect(r.title).toBe('New title')
    }))
  test('a project inserted by a signed-in person starts unapproved and unsigned', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      await actAs(tx, p.alice.id)
      const [{ id }] = await tx`
        insert into projects (title, blurb, creator, slug, stage, type, min_funding, funding_goal,
                              founder_shares, round, approved, signed_agreement)
        values ('t', 't', ${p.alice.id}, ${'approval-' + Date.now()}, 'proposal', 'grant', 100, 1000,
                10000000, 'Regrants', true, true)
        returning id`
      const r = await row(tx, id)
      expect(r.approved).toBeNull()
      expect(r.signed_agreement).toBe(false)
    }))
  test('the server still approves and marks agreements signed', () =>
    inRollback(async (tx) => {
      await tx.unsafe(migration)
      const project = await makeProject(tx, p.alice.id, 'proposal')
      await tx`set local role service_role`
      await tx`update projects set approved = true, signed_agreement = true where id = ${project.id}`
      const r = await row(tx, project.id)
      expect(r.approved).toBe(true)
      expect(r.signed_agreement).toBe(true)
    }))
})
