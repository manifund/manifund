// Pages and the public API still work (C30, C31, C33, and unchanged pages).
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, as, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { doc, RUN } from '../helpers/content'
import { env } from '../helpers/env'
import { existsSync, readFileSync } from 'node:fs'
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
  standard("C30 a profile shows comments on it (first tab) and comments the person wrote elsewhere (second tab)", async () => {
    const alicePage = await anonymous().get('/alice')
    expect(alicePage.text).toContain('id="comments-on-profile"')
    const bobWritten = await anonymous().get('/bob?tab=their-comments')
    expect(bobWritten.text).toContain('Seen on the feed')
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

describe('C32 mentions link by id', () => {
  standard('/people/id/<id> leads to the current profile', async () => {
    const r = await anonymous().get(`/people/id/${bob.id}`)
    expect([301, 302, 307, 308]).toContain(r.status)
    const res = await fetch(`${env.baseUrl}/people/id/${bob.id}`, { redirect: 'manual' })
    expect(res.headers.get('location')).toMatch(/\/bob$/)
  })
})

describe('C34 structured logs', () => {
  standard('posting writes a comment.posted line with the comment id', async () => {
    if (!existsSync(env.serverLog)) return // the log is written by local-dev; skip elsewhere
    const before = readFileSync(env.serverLog, 'utf8').length
    const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc(`Logged ${RUN}`) })
    await Bun.sleep(300)
    const added = readFileSync(env.serverLog, 'utf8').slice(before)
    const line = added.split('\n').find((l) => l.includes('"event":"comment.posted"') && l.includes(c.body.comment.id))
    expect(line).toBeDefined()
    expect(line).not.toContain('Logged') // ids, never the comment's text
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
