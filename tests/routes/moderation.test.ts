// Automatic moderation (C38-C42) and account holds (U4, U5). A phishing-looking link holds a comment
// without a model call (C39), so these run the same with or without an OpenRouter key.
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, as, tempUser, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { checked, sql } from '../helpers/db'
import { doc, docWithLink, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client, rita: Client
const phishing = () => docWithLink(`https://manifund-login.xyz/${RUN}`, 'manifund.org/verify')

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
})

describe('C38 C39 C40 a flagged comment is held', () => {
  smoke('held with a category, an AI report, and nobody notified', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: phishing() })
    expect(c.status).toBe(201)
    await checked(c.body.comment.id)
    const [row] = await sql`select held_at, held_categories from comments where id = ${c.body.comment.id}`
    expect(row.held_at).not.toBeNull()
    expect(row.held_categories).toEqual(['scam_phishing'])
    const reports = await sql`select source, reporter_id, categories from comment_reports where comment_id = ${c.body.comment.id}`
    expect(reports).toEqual([{ source: 'ai', reporter_id: null, categories: ['scam_phishing'] }])
    expect((await sql`select 1 from notifications where comment_id = ${c.body.comment.id}`).length).toBe(0)
  })
  standard('everyone sees the placeholder; the feed and the API leave it out', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: phishing() })
    await checked(c.body.comment.id)
    const page = await anonymous().get(`/projects/${w.project.slug}?tab=comments`)
    expect(page.text).toContain('Comment hidden pending review')
    const api = await anonymous().get('/api/v0/comments')
    const mine = api.body.find((x: any) => x.id === c.body.comment.id)
    expect(mine?.content ?? null).toBeNull()
    expect(mine?.held_categories).toEqual(['scam_phishing'])
  })
  standard('C42 the author can’t edit a held comment', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: phishing() })
    await checked(c.body.comment.id)
    const e = await bob.patch(`/api/comments/${c.body.comment.id}`, { content: doc(`fixed ${RUN}`) })
    expect(e.status).toBe(409)
  })
})

describe('C41 the review queue', () => {
  standard('approving lifts the hold and sends the notifications that waited', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: phishing() })
    await checked(c.body.comment.id)
    expect((await bob.post(`/api/comments/${c.body.comment.id}/resolve`, { resolution: 'approved' })).status).toBe(403)
    const r = await rita.post(`/api/comments/${c.body.comment.id}/resolve`, { resolution: 'dismissed' })
    expect(r.status).toBe(200)
    const [row] = await sql`select held_at from comments where id = ${c.body.comment.id}`
    expect(row.held_at).toBeNull()
    const [report] = await sql`select resolution from comment_reports where comment_id = ${c.body.comment.id}`
    expect(report.resolution).toBe('approved')
    const n = await sql`select reason from notifications where comment_id = ${c.body.comment.id} and recipient_id = ${alice.id}`
    expect(n.map((x: any) => x.reason)).toEqual(['comment_on_your_project'])
  })
  standard('removing leaves nothing to show', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: phishing() })
    await checked(c.body.comment.id)
    const r = await rita.post(`/api/comments/${c.body.comment.id}/resolve`, { resolution: 'removed', reason: 'phishing' })
    expect(r.status).toBe(200)
    const [row] = await sql`select content, deleted_at from comments where id = ${c.body.comment.id}`
    expect(row.content).toBeNull()
    expect(row.deleted_at).not.toBeNull()
  })
})

describe('U4 U5 a held account', () => {
  standard('can’t comment or create a project until cleared', async () => {
    const mallory = await tempUser('mallory')
    await sql`insert into account_holds (profile_id, checked_username, checked_full_name, held_at, reason, categories, model)
              select id, username, full_name, now(), 'test hold', '{impersonation}', 'test' from profiles where id = ${mallory.id}`
    const c = await mallory.post('/api/comments', { target: { project: w.project.id }, content: doc(`hello ${RUN}`) })
    expect(c.status).toBe(403)
    expect((await bob.post(`/api/account-holds/${mallory.id}`, { action: 'clear' })).status).toBe(403)
    expect((await rita.post(`/api/account-holds/${mallory.id}`, { action: 'clear' })).status).toBe(200)
    const again = await mallory.post('/api/comments', { target: { project: w.project.id }, content: doc(`hello ${RUN}`) })
    expect(again.status).toBe(201)
  })
})
