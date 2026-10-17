// Karma through the running app (docs/ai-reference/karma/README.md): a new project's starting karma, the recompute
// routes, a vote's nudge, and the pages that show karma.
//
// Who acts: the file's own people (creator, voter, outsider) and rita, the shared admin account. The admin
// recompute (slow) goes through `admin`, an unguarded client local to this file: it rewrites every profile's and
// project's karma in the local database, which is what a recompute is for. Karma is set by hand on this file's own
// rows only (the database as the server sees it), and they're deleted at the end.
import { beforeAll, describe, expect } from 'bun:test'
import { anonymous, client, cookieForEmail, type Client } from '../helpers/http'
import { as, getPeople, person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { doc, RUN } from '../helpers/content'
import { slow, smoke, standard } from '../helpers/levels'

let admin: Client, rita: Client, creator: Client, voter: Client, outsider: Client
beforeAll(async () => {
  const p = (await getPeople()).rita
  admin = client(p.id, p.username, await cookieForEmail(p.email)) // unguarded: the recompute only
  ;[rita, creator, voter, outsider] = await Promise.all([
    as('rita'),
    person('creator'),
    person('voter'),
    person('outsider'),
  ])
})

// In development, notFound() after the page started streaming answers 200 with Next's 404 fallback in the body.
const isNotFound = (r: { status: number; text: string }) =>
  r.status === 404 || r.text.includes('NEXT_HTTP_ERROR_FALLBACK;404')
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
// The page's rendered markup, without what Next streams alongside it (head, metadata tags, scripts with the RSC payload).
const visible = (html: string) =>
  html
    .replace(/<head[\s\S]*?<\/head>/, ' ')
    .replace(/<(script|title)[\s\S]*?<\/\1>/g, ' ')
const setKarma = (table: 'profiles' | 'projects', id: string, karma: number) =>
  sql`update ${sql(table)} set karma = ${karma} where id = ${id}`
const karmaOf = async (table: 'profiles' | 'projects', id: string) =>
  Number((await sql`select karma from ${sql(table)} where id = ${id}`)[0].karma)

describe('K6 a new project starts with the base and its creator term', () => {
  standard('created through the form, with a creator of 99 karma: 2 + 5 × log10(100) = 12', async () => {
    await setKarma('profiles', creator.id, 99)
    const title = `Karma start ${RUN}`
    const r = await creator.post('/api/create-project', {
      title,
      subtitle: 'test',
      minFunding: 1000,
      fundingGoal: 2000,
      verdictDate: '2099-01-01',
      description: doc('A test project.'),
      location: 'Somewhere',
      selectedCauses: [],
      selectedPrize: null,
      founderPercent: 100,
      agreedToTerms: false,
      lobbying: false,
    })
    expect(r.status).toBe(200)
    const [row] = await sql`select karma, karma_breakdown from projects where title = ${title}`
    expect(Number(row.karma)).toBeCloseTo(12, 6)
    expect(row.karma_breakdown).toMatchObject({ base: 2, creatorKarma: 99 })
    await setKarma('profiles', creator.id, 0)
  })
})

describe('K7 the recompute: the hourly job needs the cron secret, the admin route is for admins', () => {
  smoke('the scheduled job refuses calls without the secret', async () => {
    expect((await anonymous().get('/api/karma/sync')).status).toBe(401)
    const wrong = await fetch(`${env.baseUrl}/api/karma/sync`, { headers: { authorization: 'Bearer not-the-secret' } })
    expect(wrong.status).toBe(401)
  })
  standard('the admin recompute refuses visitors and signed-in non-admins', async () => {
    expect((await anonymous().post('/api/karma/recompute')).status).toBe(403)
    expect((await outsider.post('/api/karma/recompute')).status).toBe(403)
  })
  slow('an admin recompute rewrites every live project, with its parts and the time', async () => {
    const project = await makeProject(sql, creator.id, 'active', `${RUN}-recompute`)
    await setKarma('projects', project.id, 9999)
    const r = await admin.post('/api/karma/recompute')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ success: true })
    const [row] = await sql`select karma, karma_breakdown, karma_updated_at from projects where id = ${project.id}`
    // A project with no votes, comments or donations, by a creator with no karma: the base of 2.
    expect(Number(row.karma)).toBe(2)
    expect(row.karma_breakdown).toMatchObject({ base: 2 })
    expect(row.karma_updated_at).not.toBeNull()
  })
})

describe('K8 a vote moves the project\'s and its creator\'s karma at once', () => {
  standard('by (new − old) × the voter\'s weight; nothing for a creator\'s own vote or a voter without weight', async () => {
    const project = await makeProject(sql, creator.id, 'active', `${RUN}-vote`)
    await setKarma('profiles', creator.id, 0)
    await setKarma('profiles', voter.id, 100) // weight 2
    const vote = (who: Client, newMagnitude: number) => who.post('/api/vote', { projectId: project.id, newMagnitude })
    const both = async () => [await karmaOf('projects', project.id), await karmaOf('profiles', creator.id)]

    expect((await vote(voter, 1)).status).toBe(200)
    expect(await both()).toEqual([2, 2])
    expect((await vote(voter, -1)).status).toBe(200)
    expect(await both()).toEqual([-2, -2])
    expect((await vote(voter, 0)).status).toBe(200)
    expect(await both()).toEqual([0, 0])

    expect((await vote(creator, 1)).status).toBe(200)
    expect(await both()).toEqual([0, 0])
    await setKarma('profiles', voter.id, 1) // weight 0
    expect((await vote(voter, 1)).status).toBe(200)
    expect(await both()).toEqual([0, 0])
  })
})

describe('K8 a vote by someone who already follows the project', () => {
  // An upvote also follows the project; following one already followed is fine (#291).
  standard('an upvote by an existing follower answers 200 and keeps one follow', async () => {
    const project = await makeProject(sql, creator.id, 'active', `${RUN}-follower-vote`)
    await sql`insert into project_follows (project_id, follower_id) values (${project.id}, ${voter.id})`
    const r = await voter.post('/api/vote', { projectId: project.id, newMagnitude: 1 })
    expect(r.status).toBe(200)
    const follows = await sql`select 1 from project_follows where project_id = ${project.id} and follower_id = ${voter.id}`
    expect(follows).toHaveLength(1)
  })
})

describe('K12 the project page shows karma left of the title', () => {
  standard('the number comes right before the title heading, the vote arrows after it', async () => {
    const project = await makeProject(sql, creator.id, 'active', `${RUN}-page`)
    await setKarma('projects', project.id, 77.4)
    const r = await anonymous().get(`/projects/${project.slug}`)
    expect(r.status).toBe(200)
    // The rendered body only: the streamed page also carries the title in its metadata and RSC payload.
    const body = visible(r.text)
    const heading = body.search(new RegExp(`<h2[^>]*>Test project ${RUN}`))
    expect(heading).toBeGreaterThan(-1)
    expect(text(body.slice(0, heading)).trimEnd()).toMatch(/ 77$/)
    expect(body.indexOf('aria-label="Upvote"')).toBeGreaterThan(heading)
  })
})

describe('K13 /about/karma for everyone, /admin/karma for admins', () => {
  smoke('/about/karma explains the formula with the code\'s numbers, and the sidebar\'s About menu lists it', async () => {
    const r = await anonymous().get('/about/karma')
    expect(r.status).toBe(200)
    const page = text(r.text)
    expect(page).toMatch(/you get 10 karma/)
    expect(page).toMatch(/1\.5\s*× as much/)
    // The sidebar's About menu renders its links only once opened; the server sends the menu's items with the page.
    expect(r.text).toMatch(/\\?"name\\?":\\?"Karma\\?",\\?"href\\?":\\?"\/about\/karma\\?"/)
  })
  standard('/admin/karma: a 404 for visitors and signed-in non-admins; the admin gets the list and the button', async () => {
    expect(isNotFound(await anonymous().get('/admin/karma'))).toBe(true)
    expect(isNotFound(await outsider.get('/admin/karma'))).toBe(true)
    const r = await rita.get('/admin/karma')
    expect(r.status).toBe(200)
    expect(text(r.text)).toContain('Last computed')
  })
})
