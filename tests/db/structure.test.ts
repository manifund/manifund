// The rules the database itself enforces, whoever writes: tests run as the database superuser
// inside a transaction that is always rolled back.
import { beforeAll, describe, expect, test } from 'bun:test'
import { inRollback, insertComment } from '../helpers/db'
import { getPeople, makeCause, makeProject, type People } from '../helpers/fixtures'

let p: People
beforeAll(async () => {
  p = await getPeople()
})

describe('C1 a comment is about exactly one thing', () => {
  test('one target is fine, for each kind of target', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const program = await makeCause(tx, true)
      await insertComment(tx, { by: p.bob.id, project: project.id })
      await insertComment(tx, { by: p.bob.id, profile: p.alice.id })
      await insertComment(tx, { by: p.bob.id, cause: program.slug })
    }))
  test('two targets are refused', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      expect(insertComment(tx, { by: p.bob.id, project: project.id, profile: p.alice.id })).rejects.toThrow(
        'comments_one_target'
      )
    }))
  test('no target is refused', () =>
    inRollback(async (tx) => {
      expect(insertComment(tx, { by: p.bob.id })).rejects.toThrow('comments_one_target')
    }))
})

describe('C11 one level of replies', () => {
  test('a reply to a top-level comment on the same target is fine', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const root = await insertComment(tx, { by: p.bob.id, project: project.id })
      await insertComment(tx, { by: p.alice.id, project: project.id, replyingTo: root })
    }))
  test('a reply to a reply is refused', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const root = await insertComment(tx, { by: p.bob.id, project: project.id })
      const reply = await insertComment(tx, { by: p.alice.id, project: project.id, replyingTo: root })
      expect(insertComment(tx, { by: p.bob.id, project: project.id, replyingTo: reply })).rejects.toThrow(
        'replies must answer a top-level comment'
      )
    }))
  test('a reply on another target is refused', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const root = await insertComment(tx, { by: p.bob.id, project: project.id })
      expect(insertComment(tx, { by: p.bob.id, profile: p.alice.id, replyingTo: root })).rejects.toThrow(
        'same target'
      )
    }))
  test('a reply with a type is refused (C5: only top-level comments have a type)', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const root = await insertComment(tx, { by: p.bob.id, project: project.id })
      expect(
        insertComment(tx, { by: p.alice.id, project: project.id, replyingTo: root, type: 'progress update' })
      ).rejects.toThrow('replies are plain comments')
    }))
})

describe('C14 every change to the words keeps the previous version', () => {
  test('an author edit keeps the old text, written by the author', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id, text: 'first' })
      await tx`update comments set content = ${{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }] }} where id = ${id}`
      const revs = await tx`select content::text as c, written_by from comment_revisions where comment_id = ${id}`
      expect(revs).toHaveLength(1)
      expect(revs[0].c).toContain('first')
      expect(revs[0].written_by).toBe(p.bob.id)
      const [row] = await tx`select edited_at from comments where id = ${id}`
      expect(row.edited_at).not.toBeNull()
    }))
  test("a moderator's version is recorded with its note when it is replaced (C15)", () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id, text: 'phone 555-0100' })
      const t = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
      await tx`update comments set content = ${t('phone [removed]')}, edited_by = ${p.rita.id}, edit_note = 'private information' where id = ${id}`
      await tx`update comments set content = ${t('phone [removed], thanks')}, edited_by = ${p.bob.id}, edit_note = null where id = ${id}`
      const revs = await tx`select written_by, note from comment_revisions where comment_id = ${id} order by replaced_at, written_at`
      expect(revs.map((r: any) => r.written_by)).toEqual([p.bob.id, p.rita.id])
      expect(revs[1].note).toBe('private information')
    }))
  test('changes to other columns leave no version', () =>
    inRollback(async (tx) => {
      const project = await makeProject(tx, p.alice.id)
      const id = await insertComment(tx, { by: p.bob.id, project: project.id })
      await tx`update comments set special_type = null where id = ${id}`
      expect(await tx`select 1 from comment_revisions where comment_id = ${id}`).toHaveLength(0)
    }))
})
