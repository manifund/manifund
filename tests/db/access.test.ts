// Who can read what, straight from the database as a signed-in user (Supabase's `authenticated`
// role) or a visitor (`anon`). Always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { actAs, actAsAnon, inRollback, insertComment } from '../helpers/db'
import { getPeople, makeProject, type People } from '../helpers/fixtures'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

describe('C16 a removed comment keeps its text only for admins', () => {
  test('the history of a visible comment is public', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id, text: 'v1' })
      await tx`update comments set content = ${{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v2' }] }] }} where id = ${id}`
      await actAsAnon(tx)
      expect(await tx`select 1 from comment_revisions where comment_id = ${id}`).toHaveLength(1)
    }))
  test('once removed, neither visitors nor signed-in people can read its old versions', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id, text: 'a private address' })
      await tx`update comments set content = null, deleted_at = now(), deleted_by = ${p.rita.id},
                 removed_reason = 'private information' where id = ${id}`
      expect(await tx`select 1 from comment_revisions where comment_id = ${id}`).toHaveLength(1) // admins (service role)
      await actAs(tx, p.bob.id) // even the author
      expect(await tx`select 1 from comment_revisions where comment_id = ${id}`).toHaveLength(0)
      const [row] = await tx`select content, removed_reason from comments where id = ${id}`
      expect(row.content).toBeNull()
      expect(row.removed_reason).toBe('private information')
    }))
})

describe('C19 C25 people see only their own reports and notifications', () => {
  test('reports', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id })
      await tx`insert into comment_reports (comment_id, reporter_id, note) values (${id}, ${p.alice.id}, 'alice'), (${id}, ${p.rita.id}, 'rita')`
      await actAs(tx, p.alice.id)
      const mine = await tx`select note from comment_reports where comment_id = ${id}`
      expect(mine.map((r: any) => r.note)).toEqual(['alice'])
    }))
  test('notifications', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id })
      await tx`insert into notifications (recipient_id, reason, comment_id, actor_id) values
                 (${p.alice.id}, 'comment_on_your_project', ${id}, ${p.bob.id}),
                 (${p.rita.id}, 'followed_project_comment', ${id}, ${p.bob.id})`
      await actAs(tx, p.alice.id)
      expect(await tx`select 1 from notifications where comment_id = ${id}`).toHaveLength(1)
      await actAsAnon(tx)
      expect(await tx`select 1 from notifications where comment_id = ${id}`).toHaveLength(0)
    }))
})

describe('C3 browsers cannot write comments directly (with the production rules)', () => {
  // Locally the old open insert policy stays so other checkouts keep working; production drops it
  // (supabase/prod-only/comments-rework.sql). Apply that part here, inside the rolled-back transaction.
  const prodOnly = readFileSync(join(import.meta.dir, '../../supabase/prod-only/comments-rework.sql'), 'utf8')
  const dropPolicy = prodOnly.match(/drop policy[^;]+;/i)?.[0]

  test('a signed-in person inserting a comment through the database API is refused', () =>
    inRollback(async (tx) => {
      expect(dropPolicy).toBeDefined()
      const project = await makeProject(tx, p.alice.id)
      await tx.unsafe(dropPolicy!)
      await actAs(tx, p.bob.id)
      expect(insertComment(tx, { by: p.alice.id, project: project.id })).rejects.toThrow('row-level security')
    }))
  test('nobody can edit comments through the database API', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id, text: 'original' })
      await actAs(tx, p.bob.id)
      const updated = await tx`update comments set special_type = null where id = ${id} returning id`
      expect(updated).toHaveLength(0) // no update policy: the row is invisible to updates
    }))
})
