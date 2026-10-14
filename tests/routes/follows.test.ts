// Following people and saved searches through the app's routes (docs/product/follows). Everyone here is a
// throwaway account (alice follows bob); bob's projects carry the run marker, so the run's cleanup deletes them.
import { afterAll, beforeAll, describe, expect } from 'bun:test'
import { anonymous, tempUser, type Client } from '../helpers/http'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { getWorld } from '../helpers/fixtures'
import { smoke, standard } from '../helpers/levels'

let alice: Client, bob: Client, rita: Client
let org: { id: string }
beforeAll(async () => {
  ;[alice, bob, rita] = await Promise.all([
    tempUser('follows-alice'),
    tempUser('follows-bob'),
    tempUser('follows-rita'),
  ])
  ;[org] =
    await sql`insert into orgs (slug, name) values (${RUN + '-reviewed'}, ${'Org ' + RUN}) returning id`
})
afterAll(async () => {
  await sql`delete from comments where org_id = ${org.id}`
  await sql`delete from orgs where id = ${org.id}`
})

const follow = () => sql`select 1 from profile_follows
                         where follower_id = ${alice.id} and followed_id = ${bob.id}`

async function bobCreates(title: string, causes: string[] = []) {
  const r = await bob.post('/api/create-project', {
    title: `${title} ${RUN}`,
    subtitle: 'test',
    minFunding: 1000,
    fundingGoal: 5000,
    verdictDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    description: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    },
    location: 'Test',
    selectedCauses: causes.map((slug) => ({ slug })),
    selectedPrize: null,
    founderPercent: 0,
    agreedToTerms: true,
    lobbying: false,
  })
  expect(r.status).toBe(200)
  return r.body as { id: string }
}
const notified = (projectId: string, reason: string) =>
  sql`select id from notifications where recipient_id = ${alice.id} and project_id = ${projectId} and reason = ${reason}`

describe('F1 following someone covers everything they do; one click follows or unfollows', () => {
  smoke('follow, follow again, unfollow; never yourself', async () => {
    expect((await alice.post('/api/follows', { followedId: bob.id })).status).toBe(200)
    expect((await alice.post('/api/follows', { followedId: bob.id })).status).toBe(200)
    expect(await follow()).toHaveLength(1)
    expect((await alice.del('/api/follows', { followedId: bob.id })).status).toBe(200)
    expect(await follow()).toHaveLength(0)
    expect((await alice.post('/api/follows', { followedId: alice.id })).status).toBe(400)
  })
})

describe('F3 F4 people you follow: their new projects and comments notify you', () => {
  standard('a new project and a comment by someone you follow', async () => {
    await alice.post('/api/follows', { followedId: bob.id })
    const project = await bobCreates('Followed')
    expect(await notified(project.id, 'followed_person_project')).toHaveLength(1)
    const w = await getWorld()
    const c = await bob.post('/api/comments', {
      target: { project: w.project.id },
      content: doc(`Follow ${RUN}`),
    })
    expect(c.status).toBe(201)
    const rows =
      await sql`select reason from notifications where recipient_id = ${alice.id} and comment_id = ${c.body.comment.id}`
    expect(rows.map((r: any) => r.reason)).toEqual(['followed_person_comment'])
    await alice.del('/api/follows', { followedId: bob.id })
  })
})

describe('F4 someone you follow commenting on a profile or an org page notifies you', () => {
  standard('a profile comment and an org review by someone you follow', async () => {
    await alice.post('/api/follows', { followedId: bob.id })
    const onProfile = await bob.post('/api/comments', {
      target: { profile_id: rita.id },
      content: doc(`Profile ${RUN}`),
    })
    expect(onProfile.status).toBe(201)
    const reasons = async (commentId: string) =>
      (
        await sql`select reason from notifications where recipient_id = ${alice.id} and comment_id = ${commentId}`
      ).map((r: any) => r.reason)
    expect(await reasons(onProfile.body.comment.id)).toEqual(['followed_person_comment'])
    const review = await bob.post('/api/comments', {
      target: { org_id: org.id },
      content: doc(`Review ${RUN}`),
    })
    expect(review.status).toBe(201)
    expect(await reasons(review.body.comment.id)).toEqual(['followed_person_comment'])
    await alice.del('/api/follows', { followedId: bob.id })
  })
})

describe('F5 F6 F7 a saved search notifies you of new matching projects, once each', () => {
  standard('save a search, a matching project notifies, an edit does not repeat it', async () => {
    const words = `Saved${RUN}`
    const r = await alice.post('/api/saved-searches', { query: `q=${encodeURIComponent(words)}` })
    expect(r.status).toBe(201)
    expect(r.body.search.name).toBe(`"${words}"`)
    const other = await bobCreates('Elsewhere')
    expect(await notified(other.id, 'saved_search_match')).toHaveLength(0)
    const project = await bobCreates(`Matching ${words}`)
    expect(await notified(project.id, 'saved_search_match')).toHaveLength(1)
    const e = await bob.post('/api/edit-project', {
      projectId: project.id,
      projectUpdate: { blurb: 'changed' },
      causeSlugs: [],
    })
    expect(e.status).toBe(200)
    expect(await notified(project.id, 'saved_search_match')).toHaveLength(1)
    // a removed search announces nothing (there's no pausing: a search exists or it doesn't)
    expect((await alice.del('/api/saved-searches', { id: r.body.search.id })).status).toBe(200)
    const after = await bobCreates(`After removal ${words}`)
    expect(await notified(after.id, 'saved_search_match')).toHaveLength(0)
  })
  standard(
    'a match is always in the list; its email follows the one email choice (N4)',
    async () => {
      const words = `Choice${RUN}`
      const r = await alice.post('/api/saved-searches', { query: `q=${encodeURIComponent(words)}` })
      expect(r.status).toBe(201)
      const status = async (projectId: string) =>
        (
          await sql`select email_status from notifications where recipient_id = ${alice.id} and project_id = ${projectId} and reason = 'saved_search_match'`
        ).map((x: any) => x.email_status)
      // no choice stored: daily, so the email waits for the daily summary
      const daily = await bobCreates(`Daily ${words}`)
      expect(await status(daily.id)).toEqual(['digest'])
      // never: still in the list, no email
      await sql`insert into notification_email (profile_id, choice) values (${alice.id}, 'never')
              on conflict (profile_id) do update set choice = 'never'`
      const never = await bobCreates(`Never ${words}`)
      expect(await status(never.id)).toEqual(['skipped'])
      await sql`delete from notification_email where profile_id = ${alice.id}`
      await alice.del('/api/saved-searches', { id: r.body.search.id })
    }
  )
})

describe('F6 a saved search with categories matches projects with one of them', () => {
  standard('a new project in a category, and an edit that adds it', async () => {
    const [cause] = await sql`select slug from causes where open and not prize limit 1`
    const words = `Category${RUN}`
    const s = await alice.post('/api/saved-searches', {
      query: `cause=${cause.slug}&q=${words}`,
    })
    expect(s.status).toBe(201)
    const inCause = await bobCreates(`In the category ${words}`, [cause.slug])
    expect(await notified(inCause.id, 'saved_search_match')).toHaveLength(1)
    const later = await bobCreates(`Category added later ${words}`) // no category yet: no match
    expect(await notified(later.id, 'saved_search_match')).toHaveLength(0)
    const e = await bob.post('/api/edit-project', {
      projectId: later.id,
      projectUpdate: { blurb: 'now with a category' },
      causeSlugs: [cause.slug],
    })
    expect(e.status).toBe(200)
    expect(await notified(later.id, 'saved_search_match')).toHaveLength(1)
    await alice.del('/api/saved-searches', { id: s.body.search.id })
  })
})

describe('F7 one notification per person per project', () => {
  standard('two matching searches announce a project once', async () => {
    const words = `Twice${RUN}`
    const a = await alice.post('/api/saved-searches', { query: `q=${words}` })
    const b = await alice.post('/api/saved-searches', { query: `q=Two+searches+${words}` })
    const project = await bobCreates(`Two searches ${words}`)
    expect(await notified(project.id, 'saved_search_match')).toHaveLength(1)
    await alice.del('/api/saved-searches', { id: a.body.search.id })
    await alice.del('/api/saved-searches', { id: b.body.search.id })
  })

  standard('nothing more after a notification from following its creator', async () => {
    const words = `Followed${RUN}`
    const s = await alice.post('/api/saved-searches', { query: `q=${words}` })
    await alice.post('/api/follows', { followedId: bob.id })
    const project = await bobCreates(`By someone followed ${words}`)
    expect(await notified(project.id, 'followed_person_project')).toHaveLength(1)
    expect(await notified(project.id, 'saved_search_match')).toHaveLength(0)
    await alice.del('/api/follows', { followedId: bob.id })
    await alice.del('/api/saved-searches', { id: s.body.search.id })
  })
})

describe('F2 F9 a profile shows who and what someone follows, saved searches included', () => {
  standard(
    'others see the people and searches followed; the old page redirects there',
    async () => {
      const words = `Fnine${RUN}`
      expect((await alice.post('/api/follows', { followedId: bob.id })).status).toBe(200)
      const s = await alice.post('/api/saved-searches', { query: `q=${words}` })
      expect(s.status).toBe(201)
      const profile = `/${RUN}-follows-alice`
      const seen = await anonymous().get(profile)
      expect(seen.status).toBe(200)
      expect(seen.text).toContain(`/${RUN}-follows-bob`)
      expect(seen.text).toContain(words)
      await alice.del('/api/saved-searches', { id: s.body.search.id })
      await alice.del('/api/follows', { followedId: bob.id })
    }
  )
})
