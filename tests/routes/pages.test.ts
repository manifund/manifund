// Pages and the public API still work (C30, C31, C33, and unchanged pages).
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, as, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let w: World
let bob: Client
beforeAll(async () => {
  w = await getWorld()
  bob = await as('bob')
  await bob.post('/api/comments', { target: { profile_id: (await as('alice')).id }, content: doc(`Seen on the feed ${RUN}`) })
  await bob.post('/api/comments', { target: { cause_slug: w.program }, content: doc(`Program question ${RUN}`) })
})

describe('pages render', () => {
  const pages = ['/', '/projects', '/causes', '/people', '/about/regranting-data', '/donor-survey', '/docs']
  for (const path of pages) {
    smoke(`${path} renders`, async () => {
      expect((await anonymous().get(path)).status).toBe(200)
    })
  }
  standard("C30 a profile shows comments on it and comments the person wrote", async () => {
    const alicePage = await anonymous().get('/alice')
    expect(alicePage.text).toMatch(/Comments on .*profile/)
    const bobPage = await anonymous().get('/bob')
    expect(bobPage.text).toMatch(/Comments .*wrote/)
    expect(bobPage.text).toContain('Seen on the feed')
  })
  // The cause tabs render in the browser, so this checks the data the page ships; what is shown is
  // checked by the browser tests.
  standard("C2 a program's page carries its comments", async () => {
    const page = await anonymous().get(`/causes/${w.program}?tab=about`)
    expect(page.status).toBe(200)
    expect(page.text).toContain('Program question')
    expect((await anonymous().get(`/causes/${w.topic}?tab=about`)).status).toBe(200)
  })
  standard('C31 the home feed includes profile comments, tagged with where', async () => {
    const feed = await anonymous().get('/?tab=comments')
    expect(feed.text).toContain('Seen on the feed')
    expect(feed.text).toContain("profile")
  })
})

describe('C33 the public API', () => {
  smoke('comments carry their target, type and edit/removal fields; pagination works', async () => {
    const r = await anonymous().get('/api/v0/comments')
    expect(r.status).toBe(200)
    const first = r.body[0]
    for (const key of ['project', 'profile_id', 'cause_slug', 'special_type', 'edited_at', 'deleted_at', 'removed_reason']) {
      expect(first).toHaveProperty(key)
    }
    const older = await anonymous().get(`/api/v0/comments?before=${encodeURIComponent(r.body[r.body.length - 1].created_at)}`)
    expect(older.status).toBe(200)
    expect(older.body[0].created_at < r.body[r.body.length - 1].created_at).toBe(true)
  })
})
