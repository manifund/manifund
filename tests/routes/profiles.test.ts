import { beforeAll, describe, expect } from 'bun:test'
import { as, anonymous, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let alice: Client, bob: Client

beforeAll(async () => {
  w = await getWorld()
  ;[alice, bob] = await Promise.all([as('alice'), as('bob')])
})

describe('C8 comments on profiles', () => {
  smoke('the person can reply but not start a thread', async () => {
    const target = { profile_id: alice.id }
    const root = await bob.post('/api/comments', { target, content: doc(`Careful, reliable collaborator ${RUN}`) })
    expect(root.status).toBe(201)
    const own = await alice.post('/api/comments', { target, content: doc(`Hi ${RUN}`) })
    expect(own.status).toBe(403)
    const reply = await alice.post('/api/comments', { target, content: doc(`Thanks ${RUN}`), replyingTo: root.body.comment.id })
    expect(reply.status).toBe(201)
  })
  standard('profile comments are plain (no types)', async () => {
    const r = await bob.post('/api/comments', { target: { profile_id: alice.id }, content: doc(`x ${RUN}`), type: 'progress update' })
    expect(r.status).toBe(400)
  })
  standard('the profile page shows the section and the guidelines', async () => {
    const page = await anonymous().get('/alice')
    expect(page.status).toBe(200)
    expect(page.text).toContain('Commenting guidelines')
    expect(page.text).toContain('Careful, reliable collaborator')
  })
})

// C9 (rate limits on profiles and elsewhere): tests/routes/limits.test.ts
