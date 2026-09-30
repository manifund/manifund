// Who is notified of what (rows in `notifications`). Emails are skipped locally (no Postmark token).
import { beforeAll, describe, expect } from 'bun:test'
import { as, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, docWithMention, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client, rita: Client
const reasons = async (commentId: string) =>
  Object.fromEntries(
    (await sql`select recipient_id, reason from notifications where comment_id = ${commentId}`).map((r: any) => [
      r.recipient_id,
      r.reason,
    ])
  )

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
  // rita follows the project by commenting on it.
  await rita.post('/api/comments', { target: { project: w.project.id }, content: doc(`Following ${RUN}`) })
})

describe('C21 C22 one notification per person, for the strongest reason', () => {
  smoke('a top-level project comment: the creator, followers; never the author', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc(`New question ${RUN}`) })
    const r = await reasons(c.body.comment.id)
    expect(r[alice.id]).toBe('comment_on_your_project')
    expect(r[rita.id]).toBe('followed_project_comment')
    expect(r[bob.id]).toBeUndefined()
  })
  standard('mentioning the creator: a mention beats "comment on your project"', async () => {
    const c = await bob.post('/api/comments', {
      target: { project: w.project.id },
      content: docWithMention(alice.id, 'alice', `what do you think? ${RUN}`),
    })
    const r = await reasons(c.body.comment.id)
    expect(r[alice.id]).toBe('mention')
    expect(Object.values(r).filter((x) => x === 'mention')).toHaveLength(1)
  })
  standard('a reply notifies the person answered, not followers', async () => {
    const root = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc(`Root ${RUN}`) })
    const reply = await rita.post('/api/comments', { target: { project: w.project.id }, content: doc(`Reply ${RUN}`), replyingTo: root.body.comment.id })
    const r = await reasons(reply.body.comment.id)
    expect(r[bob.id]).toBe('reply_to_you')
    expect(r[alice.id]).toBe('comment_on_your_project')
  })
  standard('a profile comment notifies the person; a program comment only those answered or mentioned', async () => {
    const onProfile = await bob.post('/api/comments', { target: { profile_id: alice.id }, content: doc(`Great to work with ${RUN}`) })
    expect(await reasons(onProfile.body.comment.id)).toEqual({ [alice.id]: 'comment_on_your_profile' })
    const onProgram = await bob.post('/api/comments', { target: { cause_slug: w.program }, content: doc(`Question ${RUN}`) })
    expect(await reasons(onProgram.body.comment.id)).toEqual({})
  })
})

describe('C24 emails go out after the response (skipped locally)', () => {
  standard('each notification ends up sent or skipped, not left pending', async () => {
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc(`Email me ${RUN}`) })
    let statuses: string[] = []
    for (let i = 0; i < 20; i++) {
      statuses = (await sql`select email_status from notifications where comment_id = ${c.body.comment.id}`).map(
        (r: any) => r.email_status
      )
      if (statuses.length && statuses.every((s) => s === 'sent' || s === 'skipped')) break
      await Bun.sleep(250)
    }
    expect(statuses.length).toBeGreaterThan(0)
    expect(statuses.every((s) => s === 'sent' || s === 'skipped')).toBe(true)
  })
})

describe('C25 the notifications page', () => {
  standard('lists your notifications and marks them read', async () => {
    const page = await alice.get('/notifications')
    expect(page.status).toBe(200)
    expect(page.text).toContain('commented on your project')
    expect((await alice.post('/api/notifications/read')).status).toBe(200)
    const unread = await sql`select 1 from notifications where recipient_id = ${alice.id} and read_at is null`
    expect(unread).toHaveLength(0)
  })
})
