// Posting through the app, as the test people. Needs the dev server (local-dev/poc.sh up comments).
import { beforeAll, describe, expect, test } from 'bun:test'
import { anonymous, as, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client, rita: Client
const post = (c: Client, body: object) => c.post('/api/comments', body)

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob, rita] = await Promise.all([as('alice'), as('bob'), as('rita')])
})

describe('C3 only signed-in people post', () => {
  smoke('a visitor is refused', async () => {
    const r = await post(anonymous(), { target: { project: w.project.id }, content: doc('hi') })
    expect(r.status).toBe(401)
  })
  smoke('a signed-in person posts', async () => {
    const r = await post(bob, { target: { project: w.project.id }, content: doc(`Question ${RUN}`) })
    expect(r.status).toBe(201)
    expect(r.body.comment.commenter).toBe(bob.id)
  })
})

describe('C4 content is checked by the server too', () => {
  standard('empty text and unknown nodes are refused with a message', async () => {
    const empty = await post(bob, { target: { project: w.project.id }, content: doc('  ') })
    expect(empty.status).toBe(400)
    expect(empty.body.error).toContain('empty')
    const bad = await post(bob, { target: { project: w.project.id }, content: { type: 'doc', content: [{ type: 'script' }] } })
    expect(bad.status).toBe(400)
  })
  test.todo('over 2,000 words is refused with a message, and the attempt logged')
})

describe('C5 types', () => {
  smoke("only the project's creator posts a progress update", async () => {
    const t = { target: { project: w.project.id }, content: doc('Update'), type: 'progress update' }
    expect((await post(bob, t)).status).toBe(403)
    const ok = await post(alice, t)
    expect(ok.status).toBe(201)
    expect(ok.body.comment.special_type).toBe('progress update')
  })
  standard('final reports, grant rationales and admin notes cannot come from the comment box', async () => {
    for (const type of ['final report', 'grant rationale', 'admin note']) {
      const r = await post(alice, { target: { project: w.project.id }, content: doc('x'), type })
      expect(r.status).toBe(400)
    }
  })
})

describe('C6 hidden and draft projects take no comments', () => {
  standard('not even from the creator', async () => {
    const r = await post(alice, { target: { project: w.draft.id }, content: doc('x') })
    expect(r.status).toBe(403)
  })
})

describe('C7 commenting on a project follows it', () => {
  standard('and commenting again is fine', async () => {
    await post(rita, { target: { project: w.project.id }, content: doc(`One ${RUN}`) })
    const again = await post(rita, { target: { project: w.project.id }, content: doc(`Two ${RUN}`) })
    expect(again.status).toBe(201)
    const f = await sql`select 1 from project_follows where project_id = ${w.project.id} and follower_id = ${rita.id}`
    expect(f).toHaveLength(1)
  })
})

describe('C1 C2 what takes comments', () => {
  smoke('a program takes comments, a topic cause does not', async () => {
    expect((await post(bob, { target: { cause_slug: w.program }, content: doc(`Fits? ${RUN}`) })).status).toBe(201)
    expect((await post(bob, { target: { cause_slug: w.topic }, content: doc('x') })).status).toBe(403)
  })
  standard("a fund's account takes no profile comments (its page is the program)", async () => {
    const [fund] = await sql`select id from profiles where type = 'fund' limit 1`
    if (!fund) return
    expect((await post(bob, { target: { profile_id: fund.id }, content: doc('x') })).status).toBe(403)
  })
  standard('an unknown target or a missing project is refused', async () => {
    expect((await post(bob, { target: { projects: w.project.id }, content: doc('x') })).status).toBe(400)
    expect(
      (await post(bob, { target: { project: '00000000-0000-0000-0000-000000000000' }, content: doc('x') })).status
    ).toBe(404)
  })
})

describe('C11 one level of replies', () => {
  smoke('replying to a reply posts under the top-level comment', async () => {
    const root = await post(bob, { target: { project: w.project.id }, content: doc(`Root ${RUN}`) })
    const reply = await post(alice, { target: { project: w.project.id }, content: doc('Reply'), replyingTo: root.body.comment.id })
    const nested = await post(bob, { target: { project: w.project.id }, content: doc('Thanks'), replyingTo: reply.body.comment.id })
    expect(nested.status).toBe(201)
    expect(nested.body.comment.replying_to).toBe(root.body.comment.id)
  })
  standard('a reply with a type is refused', async () => {
    const root = await post(bob, { target: { project: w.project.id }, content: doc(`Root ${RUN}`) })
    const r = await post(alice, {
      target: { project: w.project.id },
      content: doc('x'),
      type: 'progress update',
      replyingTo: root.body.comment.id,
    })
    expect(r.status).toBe(400)
  })
})
