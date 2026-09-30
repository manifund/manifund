// C9 rate limits and C10 (refusals keep the text: checked in the browser tests). Uses throwaway
// accounts so earlier activity doesn't count.
import { beforeAll, describe, expect } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { as, tempUser, type Client } from '../helpers/http'
import { getWorld, type World } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { doc, RUN, words } from '../helpers/content'
import { slow, standard } from '../helpers/levels'

let w: World
let bob: Client
beforeAll(async () => {
  w = await getWorld()
  bob = await as('bob')
})

describe('C9 rate limits', () => {
  standard('a 6th profile comment within 5 minutes is refused, saying which limit and when to retry', async () => {
    const u = await tempUser('profiles')
    for (let i = 0; i < 5; i++) {
      const r = await u.post('/api/comments', { target: { profile_id: bob.id }, content: doc(`Note ${i} ${RUN}`) })
      expect(r.status).toBe(201)
    }
    const sixth = await u.post('/api/comments', { target: { profile_id: bob.id }, content: doc(`Note 6 ${RUN}`) })
    expect(sixth.status).toBe(429)
    expect(sixth.body.error).toContain('5 comments on profiles per 5 minutes')
    expect(sixth.body.error).toMatch(/try again in \d+ (seconds|minutes)/)
  })
  standard('an 11th project or program comment within 5 minutes is refused', async () => {
    const u = await tempUser('projects')
    for (let i = 0; i < 10; i++) {
      const target = i % 2 ? { project: w.project.id } : { cause_slug: w.program }
      expect((await u.post('/api/comments', { target, content: doc(`Point ${i} ${RUN}`) })).status).toBe(201)
    }
    const r = await u.post('/api/comments', { target: { project: w.project.id }, content: doc(`One more ${RUN}`) })
    expect(r.status).toBe(429)
  })
  standard('a 6th report within 5 minutes is refused', async () => {
    const u = await tempUser('reports')
    const ids: string[] = []
    for (let i = 0; i < 6; i++) {
      const c = await bob.post('/api/comments', { target: { project: w.project.id }, content: doc(`Reportable ${i} ${RUN}`) })
      ids.push(c.body.comment.id)
      await sql`update comments set created_at = created_at - interval '1 day' where id = ${c.body.comment.id}`
    }
    for (const id of ids.slice(0, 5)) expect((await u.post(`/api/comments/${id}/report`, {})).status).toBe(201)
    expect((await u.post(`/api/comments/${ids[5]}/report`, {})).status).toBe(429)
  })
  slow('passing 10 profile comments in a day warns the admins (a log line; Discord when configured)', async () => {
    const u = await tempUser('daily')
    const post = (i: number) => u.post('/api/comments', { target: { profile_id: bob.id }, content: doc(`Daily ${i} ${RUN}`) })
    const before = existsSync(env.serverLog) ? readFileSync(env.serverLog, 'utf8').length : 0
    for (let i = 0; i < 11; i++) {
      // Keep the 5-minute window clear: this test is about the daily count.
      await sql`update comments set created_at = now() - interval '10 minutes' where commenter = ${u.id}`
      expect((await post(i)).status).toBe(201)
    }
    if (!existsSync(env.serverLog)) return
    const added = readFileSync(env.serverLog, 'utf8').slice(before)
    expect(added).toContain('"event":"comment.daily_threshold"')
    expect(added).toContain(u.id)
  })
})

describe('C4 word limits', () => {
  standard('over 3,000 words is refused with a message; a progress update may be longer', async () => {
    const alice = await as('alice')
    const long = doc(`${words(3100)} ${RUN}`)
    const r = await bob.post('/api/comments', { target: { project: w.project.id }, content: long })
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('3,000 words')
    const update = await alice.post('/api/comments', { target: { project: w.project.id }, content: long, type: 'progress update' })
    expect(update.status).toBe(201)
  })
})
