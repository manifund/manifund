// Preloaded for route tests: fail fast without a server, warm the pages the tests visit (the dev
// server compiles each route on first use), and delete the run's fixtures at the end.
import { afterAll, beforeAll, beforeEach } from 'bun:test'
import { requireServer, anonymous, deleteTempUsers } from '../helpers/http'
import { sql } from '../helpers/db'
import { RUN } from '../helpers/content'
import { cleanWorld, getWorld } from '../helpers/fixtures'

beforeAll(async () => {
  await requireServer()
  const w = await getWorld()
  const visitor = anonymous()
  await Promise.all([
    visitor.post('/api/comments', {}),
    visitor.get(`/projects/${w.project.slug}?tab=comments`),
    visitor.get('/alice'),
  ])
}, 120_000)

// The suite posts far more than people do; so that the rate limits (C9) don't refuse the tests'
// own setup, before each test the comments and reports this run created (and only those) are moved
// a day into the past. The rate-limit tests use throwaway accounts instead.
beforeEach(async () => {
  const w = await getWorld()
  await sql`update comments set created_at = created_at - interval '1 day'
            where created_at > now() - interval '1 day'
              and (project = ${w.project.id} or cause_slug in (${w.program}, ${w.topic})
                   or content::text like ${'%' + RUN + '%'})`
  await sql`update comment_reports set created_at = created_at - interval '1 day'
            where created_at > now() - interval '1 day'
              and comment_id in (select id from comments where project = ${w.project.id})`
})

afterAll(async () => {
  await deleteTempUsers()
  await cleanWorld()
})
