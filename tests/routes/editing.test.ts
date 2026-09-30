// Editing, history and moderation. rita is an admin in development.
import { beforeAll, describe, expect } from 'bun:test'
import { as, anonymous, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client, rita: Client
const newComment = async (by: Client, text: string) =>
  (await by.post('/api/comments', { target: { project: w.project.id }, content: doc(`${text} ${RUN}`) })).body.comment
    .id as string

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
})

describe('C12 C14 authors edit; every version stays public', () => {
  smoke('an edit keeps the previous version', async () => {
    const id = await newComment(bob, 'First version')
    const r = await bob.patch(`/api/comments/${id}`, { content: doc(`Second version ${RUN}`) })
    expect(r.status).toBe(200)
    expect(r.body.comment.edited_at).not.toBeNull()
    const revs = await sql`select content::text as c, written_by from comment_revisions where comment_id = ${id}`
    expect(revs).toHaveLength(1)
    expect(revs[0].c).toContain('First version')
    expect(revs[0].written_by).toBe(bob.id)
  })
  standard("nobody else edits someone's comment", async () => {
    const id = await newComment(bob, 'Mine')
    expect((await alice.patch(`/api/comments/${id}`, { content: doc('hacked') })).status).toBe(403)
    expect((await anonymous().patch(`/api/comments/${id}`, { content: doc('hacked') })).status).toBe(401)
  })
})

describe('C13 authors cannot delete', () => {
  smoke('deleting your own comment is refused, suggesting an edit', async () => {
    const id = await newComment(bob, 'I regret this')
    const r = await bob.del(`/api/comments/${id}`, {})
    expect(r.status).toBe(403)
    expect(r.body.error).toContain('edit')
  })
})

describe('C15 C16 C17 moderation', () => {
  standard("a moderator's edit needs a note, is marked, and tells the author", async () => {
    const id = await newComment(bob, 'Call me at 555-0100')
    expect((await rita.patch(`/api/comments/${id}`, { content: doc('Call me at [removed]') })).status).toBe(400)
    const r = await rita.patch(`/api/comments/${id}`, { content: doc(`Call me at [removed] ${RUN}`), note: 'private information' })
    expect(r.status).toBe(200)
    const [row] = await sql`select edited_by, edit_note from comments where id = ${id}`
    expect(row.edited_by).toBe(rita.id)
    expect(row.edit_note).toBe('private information')
    const n = await sql`select reason from notifications where comment_id = ${id} and recipient_id = ${bob.id}`
    expect(n.map((x: any) => x.reason)).toContain('moderated_your_comment')
  })
  smoke('a removal needs a reason, leaves a placeholder, keeps replies and closes the thread', async () => {
    const id = await newComment(bob, 'Home address: 1 Example St')
    const reply = await alice.post('/api/comments', { target: { project: w.project.id }, content: doc(`Please remove that ${RUN}`), replyingTo: id })
    expect((await bob.del(`/api/comments/${id}`, { reason: 'x' })).status).toBe(403)
    expect((await rita.del(`/api/comments/${id}`, {})).status).toBe(400)
    expect((await rita.del(`/api/comments/${id}`, { reason: 'private information' })).status).toBe(200)

    const [row] = await sql`select content, deleted_at, removed_reason from comments where id = ${id}`
    expect(row.content).toBeNull()
    expect(row.removed_reason).toBe('private information')
    const [still] = await sql`select deleted_at from comments where id = ${reply.body.comment.id}`
    expect(still.deleted_at).toBeNull()
    const late = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc('late'), replyingTo: id })
    expect(late.status).toBe(409)

    const page = await anonymous().get(`/projects/${w.project.slug}?tab=comments`)
    expect(page.text).toContain('private information')
    expect(page.text).not.toContain('1 Example St')
  })
})
