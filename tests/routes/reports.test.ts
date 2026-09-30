import { beforeAll, describe, expect, test } from 'bun:test'
import { as, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client, rita: Client
let commentId: string

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
  const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc(`Buy followers now ${RUN}`) })
  commentId = c.body.comment.id
})

describe('C19 reporting a comment', () => {
  smoke('once per person, not your own, with a note and a spam toggle', async () => {
    expect((await bob.post(`/api/comments/${commentId}/report`, {})).status).toBe(400)
    const r = await alice.post(`/api/comments/${commentId}/report`, { isSpam: true, note: 'looks like spam' })
    expect(r.status).toBe(201)
    expect((await alice.post(`/api/comments/${commentId}/report`, {})).status).toBe(409)
    const [row] = await sql`select is_spam, note from comment_reports where comment_id = ${commentId} and reporter_id = ${alice.id}`
    expect(row).toEqual({ is_spam: true, note: 'looks like spam' })
  })
})

describe('C20 the admins’ queue', () => {
  standard('admins see it; others do not', async () => {
    const admin = await rita.get('/admin/comment-reports')
    expect(admin.status).toBe(200)
    expect(admin.text).toContain('Buy followers now')
    // Not just hidden: the page's data must not reach non-admins at all (the admin layout alone
    // doesn't stop the page from rendering and shipping its data).
    const other = await bob.get('/admin/comment-reports')
    expect(other.text.includes('Buy followers now')).toBe(false)
  })
  standard('dismissing closes the open reports; only admins can', async () => {
    expect((await bob.post(`/api/comments/${commentId}/resolve`, { resolution: 'dismissed' })).status).toBe(403)
    expect((await rita.post(`/api/comments/${commentId}/resolve`, { resolution: 'dismissed' })).status).toBe(200)
    const open = await sql`select 1 from comment_reports where comment_id = ${commentId} and resolved_at is null`
    expect(open).toHaveLength(0)
  })
  test.todo('acting on the comment with "also close the reports" off leaves them open')
})
