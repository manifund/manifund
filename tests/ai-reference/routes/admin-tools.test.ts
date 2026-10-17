// Admin tools, through the running app (docs/ai-reference/admin/README.md): the admin-only routes, the /db shortcuts,
// and what admins can do on project pages. Admin pages answering 404 to others (M3) are also checked, page by page,
// in tests/routes/admin.test.ts.
//
// Who acts: the file's own people (payee, creator, bidder, outsider) and rita, the shared admin account. Rita's
// guarded client allows only comment moderation and verdicts (tests/ai-reference/helpers/people.ts), so her other admin calls
// here go through `admin`, an unguarded client local to this file, and only ever touch this file's own rows: its
// throwaway people and projects (slugs starting with the run marker), deleted at the end with what they made.
import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { add } from 'date-fns'
import { anonymous, client, cookieForEmail, type Client } from '../helpers/http'
import { as, getPeople, person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let ritaCookie: string
let admin: Client, rita: Client, payee: Client, creator: Client, bidder: Client, outsider: Client
beforeAll(async () => {
  const p = (await getPeople()).rita
  ritaCookie = await cookieForEmail(p.email)
  admin = client(p.id, p.username, ritaCookie) // unguarded: this file's own rows only
  ;[rita, payee, creator, bidder, outsider] = await Promise.all([
    as('rita'),
    person('payee'),
    person('creator'),
    person('bidder'),
    person('outsider'),
  ])
})

// In development, notFound() after the page started streaming answers 200 with Next's 404 fallback in the body.
const isNotFound = (r: { status: number; text: string }) =>
  r.status === 404 || r.text.includes('NEXT_HTTP_ERROR_FALLBACK;404')
const txnsOf = (id: string) =>
  sql`select from_id, to_id, amount::float as amount, type, token, project from txns
      where from_id = ${id} or to_id = ${id} order by created_at`
const bankId = async () => {
  const file = readFileSync(`${import.meta.dir}/../../../.env.development.local`, 'utf8')
  return process.env.NEXT_PUBLIC_PROD_BANK_ID || file.match(/^NEXT_PUBLIC_PROD_BANK_ID=(.*)$/m)?.[1]
}
const newProject = (stage: string, name: string) => makeProject(sql, creator.id, stage, `${RUN}-${name}`)

describe('M3 admin pages: admins only, the rest get a 404', () => {
  smoke('/admin opens the approvals list', async () => {
    // A redirect: a 307, or in development (after streaming started) Next's redirect marker in the body.
    const res = await fetch(`${env.baseUrl}/admin`, { redirect: 'manual', headers: { cookie: ritaCookie } })
    const text = await res.text()
    if ([307, 308].includes(res.status)) expect(res.headers.get('location')).toEndWith('/admin/approvals')
    else expect(text).toContain('NEXT_REDIRECT;replace;/admin/approvals;')
  })
  standard('visitors and signed-in non-admins get a 404 on every admin page; the admin gets the page', async () => {
    for (const path of ['/admin/approvals', '/admin/users', '/admin/transactions', '/admin/projects', '/admin/tools']) {
      expect(isNotFound(await anonymous().get(path))).toBe(true)
      expect(isNotFound(await outsider.get(path))).toBe(true)
      const r = await rita.get(path)
      expect(r.status).toBe(200)
      expect(isNotFound(r)).toBe(false)
    }
  })
})

describe('M6 paying someone: a deposit from the bank, or a payout to it', () => {
  smoke('a positive amount is a deposit from the bank; a negative one a withdrawal of its absolute value', async () => {
    const bank = await bankId()
    expect(bank).toBeTruthy()
    expect((await admin.post('/api/pay-user', { userId: payee.id, amount: 25 })).status).toBe(200)
    expect((await admin.post('/api/pay-user', { userId: payee.id, amount: -20 })).status).toBe(200)
    expect(await txnsOf(payee.id)).toEqual([
      { from_id: bank, to_id: payee.id, amount: 25, type: 'deposit', token: 'USD', project: null },
      { from_id: payee.id, to_id: bank, amount: 20, type: 'withdraw', token: 'USD', project: null },
    ])
  })
  standard('anyone else gets an error and no txn is written', async () => {
    const before = (await txnsOf(outsider.id)).length
    const r = await outsider.post('/api/pay-user', { userId: outsider.id, amount: 1000 })
    expect(r.status).toBeGreaterThanOrEqual(400)
    const v = await anonymous().post('/api/pay-user', { userId: outsider.id, amount: 1000 })
    expect(v.status).toBeGreaterThanOrEqual(400)
    expect(await txnsOf(outsider.id)).toHaveLength(before)
  })
})

describe('M8 M4 /admin/users and /admin/transactions', () => {
  standard('the users page lists the person with their balance, and the CSV export', async () => {
    const listed = await person('listed')
    await admin.post('/api/pay-user', { userId: listed.id, amount: 33 })
    const r = await rita.get('/admin/users')
    expect(r.text).toContain(`${listed.username}@local.test`)
    expect(r.text).toContain('email,name,username,id,balance')
    expect(r.text).toContain(`${listed.username}@local.test,Test listed,${listed.username},${listed.id},33`)
  })
  standard('the transactions page lists the txn with both usernames', async () => {
    const shown = await person('shown')
    await admin.post('/api/pay-user', { userId: shown.id, amount: -7 })
    const r = await rita.get('/admin/transactions')
    expect(r.status).toBe(200)
    expect(r.text).toContain(shown.username)
    expect(r.text).toContain('Create txn')
  })
})

// In 30 days, as the server dates it: its time zone may differ from the test's, so the day before or after counts too.
const in30Days = () =>
  [29, 30, 31].map((days) => add(new Date(), { days }).toISOString().slice(0, 10))
async function declinedOffer(projectId: string) {
  await sql`insert into bids (project, bidder, amount, valuation, type, status)
            values (${projectId}, ${bidder.id}, 50, 0, 'donate', 'declined')`
}

describe('M10 restoring a project that was not funded', () => {
  smoke('back to proposal, closing in 30 days, declined offers pending again', async () => {
    const p = await newProject('not funded', 'restore')
    await declinedOffer(p.id)
    expect((await admin.post('/api/restore-project', { projectId: p.id })).status).toBe(200)
    const [row] = await sql`select stage, auction_close::text as close from projects where id = ${p.id}`
    expect(row.stage).toBe('proposal')
    expect(in30Days()).toContain(row.close)
    expect((await sql`select status from bids where project = ${p.id}`).map((b: any) => b.status)).toEqual(['pending'])
  })
  standard('anyone else gets 401 and nothing changes', async () => {
    const p = await newProject('not funded', 'norestore')
    await declinedOffer(p.id)
    expect((await creator.post('/api/restore-project', { projectId: p.id })).status).toBe(401)
    expect((await anonymous().post('/api/restore-project', { projectId: p.id })).status).toBe(401)
    expect((await sql`select stage from projects where id = ${p.id}`)[0].stage).toBe('not funded')
    expect((await sql`select status from bids where project = ${p.id}`)[0].status).toBe('declined')
  })
})

describe('M11 pausing a proposal’s reminders', () => {
  smoke('an admin pauses and unpauses', async () => {
    const p = await newProject('proposal', 'pause')
    expect((await admin.post('/api/set-alerts-paused', { projectId: p.id, alertsPaused: true })).status).toBe(200)
    expect((await sql`select alerts_paused from projects where id = ${p.id}`)[0].alerts_paused).toBe(true)
    expect((await admin.post('/api/set-alerts-paused', { projectId: p.id, alertsPaused: false })).status).toBe(200)
    expect((await sql`select alerts_paused from projects where id = ${p.id}`)[0].alerts_paused).toBe(false)
  })
  standard('anyone else, the creator included, gets 403 with a message', async () => {
    const p = await newProject('proposal', 'nopause')
    for (const who of [creator, anonymous()]) {
      const r = await who.post('/api/set-alerts-paused', { projectId: p.id, alertsPaused: true })
      expect(r.status).toBe(403)
      expect(r.body.error).toBe('Only admins can pause project alerts.')
    }
    expect((await sql`select alerts_paused from projects where id = ${p.id}`)[0].alerts_paused).toBe(false)
  })
})

// The closing check (/api/close-grants) reads and closes every project in the shared database and needs the cron
// secret: not something one test file can run safely next to others.
test.todo('M12 a paused project gets no reminders from the daily closing check (needs the close-grants cron)', () => {})

describe('M14 /api/list-users', () => {
  standard("every account's id and email for an admin; anyone else is refused", async () => {
    const r = await rita.get('/api/list-users')
    expect(r.status).toBe(200)
    expect(r.body).toContainEqual({ id: payee.id, email: `${payee.username}@local.test` })
    expect((await outsider.get('/api/list-users')).status).toBeGreaterThanOrEqual(400)
    const v = await anonymous().get('/api/list-users')
    expect(v.status).toBeGreaterThanOrEqual(400)
    expect(v.text).not.toContain('@local.test')
  })
})

describe('M15 M16 the /db shortcuts', () => {
  const filter = (id: string) => `filter=id%3Aeq%3A${id}`
  smoke('/<username>/db redirects to the row in Supabase’s dashboard; unknown: 404', async () => {
    const res = await fetch(`${env.baseUrl}/${payee.username}/db`, { redirect: 'manual', headers: { cookie: ritaCookie } })
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toStartWith('https://supabase.com/dashboard/project/')
    expect(res.headers.get('location')).toContain(filter(payee.id))
    expect(isNotFound(await rita.get(`/${RUN}-nobody/db`))).toBe(true)
  })
  standard('/projects/<slug>/db redirects to the project’s row', async () => {
    const p = await newProject('active', 'dbshortcut')
    const res = await fetch(`${env.baseUrl}/projects/${p.slug}/db`, { redirect: 'manual', headers: { cookie: ritaCookie } })
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location')).toContain(filter(p.id))
  })
})

describe('M17 admins open hidden and draft projects', () => {
  standard('others see "Access denied"; the creator and admins see the project', async () => {
    for (const stage of ['hidden', 'draft']) {
      const p = await newProject(stage, `private-${stage}`)
      for (const who of [anonymous(), outsider]) {
        expect((await who.get(`/projects/${p.slug}`)).text).toContain('Access denied')
      }
      for (const who of [rita, creator]) {
        const r = await who.get(`/projects/${p.slug}`)
        expect(r.status).toBe(200)
        expect(r.text).not.toContain('Access denied')
        expect(r.text).toContain(`Test project ${RUN}`)
      }
    }
  })
})

describe('M18 admins change any field of any project; creators only the form’s fields; scores never', () => {
  standard('an admin changes a field the forms don’t show; the creator’s change to it is dropped', async () => {
    const p = await newProject('active', 'edit')
    const edit = (who: Client, projectUpdate: Record<string, unknown>) =>
      who.post('/api/edit-project', { projectId: p.id, projectUpdate, causeSlugs: [] })
    expect((await edit(admin, { external_link: `https://example.test/${RUN}`, quality_score: 99 })).status).toBe(200)
    let [row] = await sql`select external_link, quality_score from projects where id = ${p.id}`
    expect(row.external_link).toBe(`https://example.test/${RUN}`)
    expect(row.quality_score).not.toBe(99)
    expect((await edit(creator, { external_link: 'https://example.test/creator', blurb: `by creator ${RUN}` })).status).toBe(200)
    ;[row] = await sql`select external_link, blurb from projects where id = ${p.id}`
    expect(row.external_link).toBe(`https://example.test/${RUN}`)
    expect(row.blurb).toBe(`by creator ${RUN}`)
  })
})

describe('admin open questions (docs/ai-reference/admin/README.md): suspected bugs, skipped until decided', () => {
  // Open question 1: a rejected proposal (approved = false) comes back still rejected, so it never returns to the
  // approvals list. Turn on once restore clears the verdict (or refuses rejected projects: then change the check).
  test.skip('M10 a restored rejected proposal is back without a verdict (open question 1)', async () => {
    const p = await newProject('not funded', 'rejected')
    await sql`update projects set approved = false where id = ${p.id}`
    await admin.post('/api/restore-project', { projectId: p.id })
    expect((await sql`select approved from projects where id = ${p.id}`)[0].approved).toBeNull()
  })
  // Open question 2: the receipt's id is a fresh random id, not the txn's, and the route returns nothing about the
  // txn. Turn on once the route returns the txn whose id the receipt carries.
  test.skip('M7 the route returns the txn, whose id the receipt carries (open question 2)', async () => {
    const r = await admin.post('/api/pay-user', { userId: payee.id, amount: 1, sendDonationReceipt: true })
    const [last] = await sql`select id from txns where to_id = ${payee.id} order by created_at desc limit 1`
    expect(r.body?.id).toBe(last.id)
  })
  // Open question 5: an unknown slug errors (500) instead of a 404 like the profile shortcut.
  test.skip('M16 /projects/<unknown>/db gets a 404 (open question 5)', async () => {
    expect(isNotFound(await admin.get(`/projects/${RUN}-nothing/db`))).toBe(true)
  })
})
