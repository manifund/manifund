// Causes, rounds, funds, programs (docs/ai-reference/causes) through the app: the pages, and what creating or
// editing a project saves. Everything is this file's own: its causes and rounds
// (slugs and titles carry the run marker), projects, a fund account and its donors, all deleted at the end.
//
// Three rules hang on real programs by slug (EA Community Choice's tabs, Falcon Fund's apply button) or by round
// title (Regrants, Independent): those tests only read the real pages' tabs and labels, never their rows. Creating
// a project for a real open program (R11) links this file's project to it; the link goes with the project.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { anonymous, type Client } from '../helpers/http'
import { person } from '../helpers/people'
import { cleanWorld, makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { slow, smoke, standard } from '../helpers/levels'

const IMG = 'https://fkousziwzbnkdkldjper.supabase.co/storage/v1/object/public/round-header-images/test.png'
const TOPIC = { slug: `${RUN}-topic`, title: `Topic ${RUN}` }
const CLOSED_TOPIC = { slug: `${RUN}-closed`, title: `Closed topic ${RUN}` }
const PROGRAM = { slug: `${RUN}-program`, title: `Program ${RUN}` }
const PAST = { slug: `${RUN}-past`, title: `Past program ${RUN}` }
const FUNDED = { slug: `${RUN}-funded`, title: `Funded ${RUN}` }
const ROUND = { slug: `${RUN}-round`, title: `Round ${RUN}` }
const OTHER_TOPIC = { slug: `${RUN}-other`, title: `Other topic ${RUN}` }
// A program without special terms puts its projects in the round named after it (create-project.ts: toTitleCase).
const PROGRAM_ROUND = `Program ${RUN.charAt(0).toUpperCase()}${RUN.slice(1)}`

let creator: Client, fund: Client, donor: Client, bank: Client, regrantor: Client
const visitor = anonymous()
const titled = (stage: string) => `${stage} project ${RUN}`

const isNotFound = (text: string) => text.includes('NEXT_HTTP_ERROR_FALLBACK;404')
const tabs = (text: string) => [...text.matchAll(/href="\?tab=([a-z]+)"/g)].map((m) => m[1])

beforeAll(async () => {
  ;[creator, fund, donor, bank, regrantor] = await Promise.all([
    person('creator'), person('fund'), person('donor'), person('bank'), person('regrantor'),
  ])
  await sql`update profiles set type = 'fund', full_name = ${'Fund ' + RUN}, bio = ${'Fund bio ' + RUN},
              long_description = ${doc('Fund long description ' + RUN)} where id = ${fund.id}`
  await sql`update profiles set full_name = ${'Donor ' + RUN} where id = ${donor.id}`
  await sql`update profiles set regranter_status = true where id = ${regrantor.id}`
  const cause = (c: { slug: string; title: string }, f: Record<string, unknown>) =>
    sql`insert into causes ${sql({ slug: c.slug, title: c.title, header_image_url: IMG, ...f })}`
  await cause(TOPIC, { prize: false, open: true, description: doc('About the topic ' + RUN) })
  await cause(CLOSED_TOPIC, { prize: false, open: false })
  await cause(OTHER_TOPIC, { prize: false, open: true })
  await cause(PROGRAM, { prize: true, open: true })
  await cause(PAST, { prize: true, open: false })
  await cause(FUNDED, { prize: false, open: false, fund_id: fund.id })
  await sql`insert into rounds ${sql({ ...ROUND, retro_pool: 5000, description: doc('About the round ' + RUN) })}`
  await sql`insert into rounds ${sql({ title: PROGRAM_ROUND, slug: `${RUN}-program-round` })}`
  // Three projects in the topic and the round: one visible, one hidden, one draft.
  for (const stage of ['active', 'hidden', 'draft']) {
    const project = await makeProject(sql, creator.id, stage, `${RUN}-${stage}`)
    await sql`update projects set title = ${titled(stage)}, round = ${ROUND.title} where id = ${project.id}`
    await sql`insert into project_causes (project_id, cause_slug) values (${project.id}, ${TOPIC.slug})`
  }
  // A donation to the fund, for its history.
  await sql`insert into txns (from_id, to_id, amount, token, type) values (${donor.id}, ${fund.id}, 25, 'USD', 'profile donation')`
})

afterAll(async () => {
  await cleanWorld()
  await sql`delete from project_causes where cause_slug like ${RUN + '%'}`
  await sql`delete from causes where slug like ${RUN + '%'}`
  await sql`delete from rounds where slug like ${RUN + '%'}`
})

describe('R3 /causes: active programs, past prize rounds, causes', () => {
  smoke('each cause in its group, with its number of projects (no hidden projects or drafts)', async () => {
    const r = await visitor.get('/causes')
    expect(r.status).toBe(200)
    const at = (s: string) => r.text.indexOf(s)
    const [active, past, causes] = [at('>Active programs<'), at('>Past prize rounds<'), at('>Causes<')]
    expect(active).toBeGreaterThan(-1)
    expect(active).toBeLessThan(past)
    expect(past).toBeLessThan(causes)
    const card = (c: { title: string }) => at(`>${c.title}</p>`)
    expect(card(PROGRAM)).toBeGreaterThan(active)
    expect(card(PROGRAM)).toBeLessThan(past)
    expect(card(PAST)).toBeGreaterThan(past)
    expect(card(PAST)).toBeLessThan(causes)
    expect(card(TOPIC)).toBeGreaterThan(causes)
    expect(card(CLOSED_TOPIC)).toBeGreaterThan(causes) // closed topics stay listed
    const count = r.text.slice(card(TOPIC)).match(/>(\d+)(?:<!-- -->)? projects</)
    expect(count?.[1]).toBe('1')
    // Open programs are outlined.
    expect(r.text).toMatch(new RegExp(`class="[^"]*ring-orange-500[^"]*" href="/causes/${PROGRAM.slug}"`))
    expect(r.text).not.toMatch(new RegExp(`class="[^"]*ring-orange-500[^"]*" href="/causes/${PAST.slug}"`))
  })
})

describe('R4 R5 a cause\'s page', () => {
  smoke('its numbers and projects leave out hidden projects and drafts', async () => {
    const r = await visitor.get(`/causes/${TOPIC.slug}`)
    expect(r.text).toContain(TOPIC.title)
    expect(r.text).toContain(titled('active'))
    expect(r.text).not.toContain(titled('hidden'))
    expect(r.text).not.toContain(titled('draft'))
    expect(r.text).toMatch(/>0(<!-- -->)? proposals</)
    expect(r.text).toMatch(/>1(<!-- -->)? active projects</)
  })
  smoke('tabs: Grants, and About when it has a description; no certificates or Donate without them', async () => {
    const r = await visitor.get(`/causes/${TOPIC.slug}`)
    expect(tabs(r.text)).toEqual(['grants', 'about'])
    const about = await visitor.get(`/causes/${TOPIC.slug}?tab=about`)
    expect(about.text).toContain('About the topic ' + RUN)
  })
  standard('no projects: "Coming soon!"; no description: no About tab', async () => {
    const r = await visitor.get(`/causes/${PAST.slug}`)
    expect(r.text).toContain('Coming soon!')
    expect(tabs(r.text)).toEqual(['grants'])
  })
  standard('an unknown cause is not found', async () => {
    const r = await visitor.get(`/causes/${RUN}-no-such-cause`)
    expect(isNotFound(r.text)).toBe(true)
  })
  standard('Falcon Fund\'s About tab starts with "Apply for funding" (the real program\'s page, read only)', async () => {
    const r = await visitor.get('/causes/falcon-fund?tab=about')
    expect(r.text).toMatch(/href="\/create\?prize=falcon-fund"[^>]*>Apply for funding</)
  })
  slow('EA Community Choice adds Participants and Matching (the real program\'s page, read only)', async () => {
    const r = await visitor.get('/causes/ea-community-choice')
    expect(tabs(r.text)).toEqual(expect.arrayContaining(['participants', 'match']))
    const other = await visitor.get(`/causes/${TOPIC.slug}`)
    expect(tabs(other.text)).not.toContain('participants')
  })
})

// "Edit cause" and "Edit round" render in the browser only (the editor reads the signed-in session there), so the
// server's HTML never has them, for admins or anyone.
test.todo('R6 admins see "Edit cause" on the About tab; nobody else does: needs a browser test (the button renders client-side only)', () => {})

describe('R15 R14 a cause with a fund account has a Donate tab', () => {
  standard('the fund\'s bio, the donate box and its donations history', async () => {
    const r = await visitor.get(`/causes/${FUNDED.slug}?tab=donate`)
    expect(tabs(r.text)).toContain('donate')
    expect(r.text).toContain('Fund bio ' + RUN)
    expect(r.text).toContain('Donate via...')
    expect(r.text).toContain('Donor ' + RUN)
    const plain = await visitor.get(`/causes/${TOPIC.slug}`)
    expect(tabs(plain.text)).not.toContain('donate')
  })
})

// The create form renders in the browser only (the server's HTML has the causes as data, not the form), so what it
// offers needs a browser test; what it saves is checked below (R9, R11) and the 3-cause limit in components (R8).
test.todo('R8 the create form offers open topics only; the edit form open causes plus those the project has: needs a browser test (the forms render client-side only)', () => {})
test.todo('R9 open programs are offered, closed ones not; link-only ones only through ?prize=, which preselects: needs a browser test (client-side form)', () => {})

// What /api/create-project saves (the form's request, as the browser sends it).
let n = 0
async function create(selectedPrize: { slug: string; title: string } | null, selectedCauses = [TOPIC]) {
  const title = `Created ${++n} ${RUN}`
  const r = await creator.post('/api/create-project', {
    title,
    subtitle: 'test',
    minFunding: 1000,
    fundingGoal: 2000,
    verdictDate: '2099-01-01',
    description: doc('A test project.'),
    location: 'Somewhere',
    selectedCauses,
    selectedPrize,
    founderPercent: 100,
    agreedToTerms: false,
    lobbying: false,
  })
  expect(r.status).toBe(200)
  const [row] = await sql`select id, round, stage, type, min_funding::int as min_funding from projects where title = ${title}`
  const causes = await sql`select cause_slug from project_causes where project_id = ${row.id} order by cause_slug`
  return { ...row, causes: causes.map((c: any) => c.cause_slug) }
}

describe('R11 R9 the round and causes a new project gets', () => {
  smoke('no program: the Regrants round, a grant proposal, with the chosen topics', async () => {
    const p = await create(null)
    expect(p).toMatchObject({ round: 'Regrants', stage: 'proposal', type: 'grant', min_funding: 1000, causes: [TOPIC.slug] })
  })
  standard('Falcon Fund: Independent, a normal grant proposal', async () => {
    const p = await create({ slug: 'falcon-fund', title: 'Falcon Fund' })
    expect(p).toMatchObject({ round: 'Independent', min_funding: 1000, type: 'grant', stage: 'proposal' })
  })
  standard('any other program: an impact certificate in the round named after it', async () => {
    const p = await create(PROGRAM)
    expect(p).toMatchObject({ round: PROGRAM_ROUND, type: 'cert' })
    expect(p.causes).toContain(PROGRAM.slug)
  })
})

describe('R10 R8 editing a project replaces its causes', () => {
  standard('the list sent replaces the old one; a cause sent twice is saved once', async () => {
    const p = await create(null)
    const r = await creator.post('/api/edit-project', {
      projectId: p.id,
      causeSlugs: [OTHER_TOPIC.slug, OTHER_TOPIC.slug],
      projectUpdate: { blurb: 'edited' },
    })
    expect(r.status).toBe(200)
    const rows = await sql`select cause_slug from project_causes where project_id = ${p.id} order by cause_slug`
    expect(rows.map((c: any) => c.cause_slug)).toEqual([OTHER_TOPIC.slug])
  })
})

describe('R12 a round\'s page', () => {
  smoke('title, pool, its projects (no hidden projects or drafts), Projects and About tabs', async () => {
    const r = await visitor.get(`/rounds/${ROUND.slug}`)
    expect(r.text).toContain(ROUND.title)
    expect(r.text).toContain(titled('active'))
    expect(r.text).not.toContain(titled('hidden'))
    expect(r.text).not.toContain(titled('draft'))
    expect(r.text).toMatch(/>\$5K<[\s\S]*available funding/)
    expect(tabs(r.text)).toEqual(['projects', 'about'])
    const about = await visitor.get(`/rounds/${ROUND.slug}?tab=about`)
    expect(about.text).toContain('About the round ' + RUN)
  })
  standard('an unknown round is not found', async () => {
    expect(isNotFound((await visitor.get(`/rounds/${RUN}-no-such-round`)).text)).toBe(true)
  })
  slow('Independent shows proposals, unfunded and active projects (the real round\'s labels, read only)', async () => {
    const r = await visitor.get('/rounds/independent')
    for (const label of ['>proposals<', '>unfunded projects<', '>active projects<']) expect(r.text).toContain(label)
  })
  slow('Regrants has a Regrantors tab listing regrantors (the real round\'s page, read only)', async () => {
    const r = await visitor.get('/rounds/regrants?tab=regrants')
    expect(tabs(r.text)).toEqual(['projects', 'regrants', 'about'])
    expect(r.text).toContain(regrantor.username)
  })

  // Open question 2 (docs/ai-reference/causes/README.md): the countdowns count the wrong way and show for past dates.
  // Turn on once decided (fixed, or the countdowns dropped).
  test.skip('a round whose dates are past shows no countdown (open question 2)', async () => {
    const old = { slug: `${RUN}-old`, title: `Old round ${RUN}` }
    await sql`insert into rounds ${sql({ ...old, auction_close_date: '2023-03-12', proposal_due_date: '2023-03-01', eval_date: '2023-09-01' })}`
    try {
      const r = await visitor.get(`/rounds/${old.slug}`)
      expect(r.text).not.toContain('days to bid')
      expect(r.text).not.toContain('days to submit projects')
    } finally {
      await sql`delete from rounds where slug = ${old.slug}`
    }
  })
})

describe('R13 R14 a fund\'s page', () => {
  smoke('at the fund\'s address: "<name> fund", its bio, the donate box, its donations and long description', async () => {
    for (const path of [`/${fund.username}`, `/funds/${fund.username}`]) {
      const r = await visitor.get(path)
      expect(r.text).toMatch(new RegExp(`>Fund ${RUN}(<!-- -->)? fund<`))
      for (const s of ['Fund bio ' + RUN, 'Donate via...', 'Donor ' + RUN, 'Fund long description ' + RUN]) {
        expect(r.text).toContain(s)
      }
    }
  })
  standard('visitors are asked to sign in and get only the wire details; signed-in people get card and balance', async () => {
    const v = await visitor.get(`/${fund.username}`)
    expect(v.text).toContain('Sign in to donate')
    expect(v.text).toContain('See details')
    expect(v.text).not.toContain('>Checkout<')
    const d = await donor.get(`/${fund.username}`)
    expect(d.text).not.toContain('Sign in to donate')
    expect(d.text).toContain('>Checkout<')
    expect(d.text).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>)[\s\S])*Donate<\/button>/) // no amount yet
  })
  standard('donating from one\'s charity balance moves the money to the fund', async () => {
    await sql`insert into txns (from_id, to_id, amount, token, type) values (${bank.id}, ${donor.id}, 100, 'USD', 'profile donation')`
    const r = await donor.post('/api/transfer-money', { amount: 30, toId: fund.id, fromId: donor.id })
    expect(r.status).toBe(200)
    const rows = await sql`select amount::int as amount, type from txns where from_id = ${donor.id} and to_id = ${fund.id} and amount = 30`
    expect(rows).toEqual([{ amount: 30, type: 'profile donation' }])
  })
})
