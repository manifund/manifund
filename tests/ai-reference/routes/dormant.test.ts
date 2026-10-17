// Dormant features (docs/ai-reference/dormant/README.md) through the app: the shares every new project gets (X1), a
// certificate's page (X2), the trade routes (X5, X6), the webhook matching a new offer on a certificate (X7) and the
// grant evaluation pages (X11). Everything trades on the file's own certificate projects, between the file's own
// people: never on real certificates or against real offers.
import { afterAll, beforeAll, describe, expect } from 'bun:test'
import { anonymous, type Client } from '../helpers/http'
import { person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

const SHARES = 10_000_000
let creator: Client, trader: Client, holder: Client, funder: Client, evaluator: Client

beforeAll(async () => {
  ;[creator, trader, holder, funder, evaluator] = await Promise.all([
    person('creator'),
    person('trader'),
    person('holder'),
    person('funder'),
    person('evaluator'),
  ])
  // The trader gets $1,000 of charity balance (a profile donation from the file's funder).
  await sql`insert into txns (from_id, to_id, amount, token, type)
            values (${funder.id}, ${trader.id}, 1000, 'USD', 'profile donation')`
})

// A certificate of the file's creator, active, with all its shares minted to the creator and 10% sold to
// `holder` for $100; with a market maker (1,000,000 shares and $20, valuation $200) when asked.
const amms: string[] = []
let n = 0
async function certificate(opts: { amm?: boolean } = {}) {
  const project = await makeProject(sql, creator.id, 'active', `${RUN}-c${++n}`)
  await sql`update projects set type = 'cert', amm_shares = ${opts.amm ? 1_000_000 : null}
            where id = ${project.id}`
  // A trade is always two txns in one bundle (the page values the project from its latest trade).
  const sale = crypto.randomUUID()
  await sql`insert into txns (from_id, to_id, amount, token, project, type, bundle)
            values (null, ${creator.id}, ${SHARES}, ${project.id}, ${project.id}, 'mint cert', null),
                   (${creator.id}, ${holder.id}, 1000000, ${project.id}, ${project.id}, 'user to user trade', ${sale}),
                   (${holder.id}, ${creator.id}, 100, 'USD', ${project.id}, 'user to user trade', ${sale})`
  if (opts.amm) {
    await sql`insert into profiles (id, username, full_name, type)
              values (${project.id}, ${project.slug + '-amm'}, ${project.slug + '-amm'}, 'amm')`
    amms.push(project.id)
    const bundle = crypto.randomUUID()
    await sql`insert into txns (from_id, to_id, amount, token, project, type, bundle)
              values (${creator.id}, ${project.id}, 1000000, ${project.id}, ${project.id}, 'inject amm liquidity', ${bundle}),
                     (${creator.id}, ${project.id}, 20, 'USD', ${project.id}, 'inject amm liquidity', ${bundle})`
  }
  return project
}

afterAll(async () => {
  // The market makers' profiles (same id as their project): their txns first.
  if (amms.length) {
    await sql`delete from txns where project in ${sql(amms)}`
    await sql`delete from profiles where id in ${sql(amms)}`
  }
})

const txnsOn = (projectId: string, type: string) =>
  sql`select from_id, to_id, token, amount::float as amount, bundle from txns
      where project = ${projectId} and type = ${type} order by token`
const bidsOn = (projectId: string) =>
  sql`select bidder, type, status, amount::float as amount, valuation::float as valuation from bids
      where project = ${projectId} order by created_at`
const follows = async (projectId: string, who: string) =>
  (await sql`select 1 from project_follows where project_id = ${projectId} and follower_id = ${who}`)
    .length > 0
async function until<T>(check: () => Promise<T | undefined | false>, ms = 15_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await check()
    if (v) return v
    await Bun.sleep(250)
  }
  return undefined
}
const trade = (who: Client, body: Record<string, unknown>) => who.post('/api/trade-with-amm', body)
// In dev, a page that calls notFound() after streaming starts still answers 200.
const found = (r: { status: number; text: string }) =>
  r.status === 200 && !r.text.includes('NEXT_HTTP_ERROR_FALLBACK;404')

describe('X1 a new project gives its creator all its shares', () => {
  smoke('creating a grant records a mint of 10,000,000 shares to the creator', async () => {
    const r = await creator.post('/api/create-project', {
      title: `Shares ${RUN}`,
      subtitle: 'test',
      minFunding: 500,
      fundingGoal: 1000,
      verdictDate: '2099-01-01',
      description: doc('A test project.'),
      location: 'Nowhere',
      selectedCauses: [],
      selectedPrize: null,
      founderPercent: 100,
      agreedToTerms: true,
      lobbying: false,
    })
    expect(r.status).toBe(200)
    expect(r.body.type).toBe('grant')
    expect(await txnsOn(r.body.id, 'mint cert')).toEqual([
      { from_id: null, to_id: creator.id, token: r.body.id, amount: SHARES, bundle: null },
    ])
  })
})

describe('X2 an active certificate’s page', () => {
  smoke('visitors see the Offers and Shareholders tabs and are asked to sign in to trade', async () => {
    const cert = await certificate()
    const page = await anonymous().get(`/projects/${cert.slug}`)
    expect(found(page)).toBe(true)
    expect(page.text).toContain('Sign in to trade')
    expect(page.text).toContain('Shareholders')
    expect(page.text).toContain('Offers')
  })
  standard('signed in, without a market maker: "Make a trade offer"', async () => {
    const cert = await certificate()
    const page = await trader.get(`/projects/${cert.slug}`)
    expect(found(page)).toBe(true)
    expect(page.text).toContain('Make a trade offer')
    expect(page.text).not.toContain('Sign in to trade')
  })
  standard('a grant shows no trade box and no Shareholders tab', async () => {
    const grant = await makeProject(sql, creator.id, 'active', `${RUN}-grant`)
    const page = await anonymous().get(`/projects/${grant.slug}`)
    expect(found(page)).toBe(true)
    expect(page.text).not.toContain('Sign in to trade')
    expect(page.text).not.toContain('Shareholders')
  })
})

describe('X5 trading with the market maker', () => {
  smoke('visitors are refused', async () => {
    const cert = await certificate({ amm: true })
    const r = await trade(anonymous(), { projectId: cert.id, amount: 5, buying: true })
    expect(r.status).toBe(401)
    expect(await txnsOn(cert.id, 'user to amm trade')).toHaveLength(0)
  })
  standard('the amount must be a positive number, and a valuation, if any, too', async () => {
    const cert = await certificate({ amm: true })
    for (const body of [
      { amount: 0 },
      { amount: -5 },
      { amount: 'five' },
      { amount: 5, valuation: 0 },
      { amount: 5, valuation: -100 },
    ]) {
      const r = await trade(trader, { projectId: cert.id, buying: true, ...body })
      expect(r.status).toBe(400)
      expect(r.text).toBe('Invalid amount')
    }
    expect(await txnsOn(cert.id, 'user to amm trade')).toHaveLength(0)
  })
  standard('a trade X4 refuses answers 400 with its message', async () => {
    const cert = await certificate({ amm: true })
    const r = await trade(trader, { projectId: cert.id, amount: 5000, buying: true })
    expect(r.status).toBe(400)
    expect(r.text).toBe('Insufficient funds')
    const s = await trade(trader, { projectId: cert.id, amount: 1000, buying: false })
    expect(s.status).toBe(400)
    expect(s.text).toBe('Insufficient shares')
  })
  smoke('a purchase moves dollars to the market maker and shares back, in one bundle; the buyer follows', async () => {
    const cert = await certificate({ amm: true })
    const r = await trade(trader, { projectId: cert.id, amount: 5, buying: true })
    expect(r.status).toBe(200)
    const txns = await txnsOn(cert.id, 'user to amm trade')
    expect(txns).toHaveLength(2)
    const usd = txns.find((t: any) => t.token === 'USD')
    const shares = txns.find((t: any) => t.token !== 'USD')
    expect(usd).toMatchObject({ from_id: trader.id, to_id: cert.id, amount: 5 })
    // Constant product: (20 + 5) × (1,000,000 − s) = 20 × 1,000,000, so s = 200,000.
    expect(shares).toMatchObject({ from_id: cert.id, to_id: trader.id, token: cert.id })
    expect(shares.amount).toBeCloseTo(200_000, 3)
    expect(usd.bundle).toBe(shares.bundle)
    expect(await follows(cert.id, trader.id)).toBe(true)
  })
  standard('with a valuation, it saves a pending offer and moves no money', async () => {
    const cert = await certificate({ amm: true })
    const r = await trade(trader, { projectId: cert.id, amount: 10, buying: true, valuation: 150 })
    expect(r.status).toBe(200)
    expect(await bidsOn(cert.id)).toEqual([
      { bidder: trader.id, type: 'buy', status: 'pending', amount: 10, valuation: 150 },
    ])
    expect(await txnsOn(cert.id, 'user to amm trade')).toHaveLength(0)
  })
})

describe('X6 accepting someone’s offer', () => {
  // The trader offers $10 for shares at a $1,000 valuation (1% = 100,000 shares). Inserted directly: the route
  // that places offers is X5's.
  async function buyOffer(projectId: string, amount = 10) {
    const [row] = await sql`insert into bids (project, bidder, amount, valuation, type, status)
                            values (${projectId}, ${trader.id}, ${amount}, 1000, 'buy', 'pending') returning id`
    return row.id as string
  }
  const accept = (who: Client, oldBidId: string, numDollarsInTrade: unknown) =>
    who.post('/api/trade-with-limit', { oldBidId, numDollarsInTrade })

  standard('refused: visitors, one’s own offer, nothing or more than the offer', async () => {
    const cert = await certificate()
    const bid = await buyOffer(cert.id)
    for (const [who, amount] of [
      [anonymous(), 5],
      [trader, 5],
      [holder, 0],
      [holder, 11],
    ] as const) {
      expect((await accept(who, bid, amount)).status).toBeGreaterThanOrEqual(400)
    }
    expect(await txnsOn(cert.id, 'user to user trade')).toHaveLength(2) // only the setup's
    expect((await bidsOn(cert.id))[0]).toMatchObject({ status: 'pending', amount: 10 })
  })
  smoke('selling into a buy offer: shares and dollars in one bundle at its valuation; X8 the offer shrinks', async () => {
    const cert = await certificate()
    const bid = await buyOffer(cert.id)
    expect((await accept(holder, bid, 4)).status).toBe(200)
    const trades = (await txnsOn(cert.id, 'user to user trade')).filter(
      (t: any) => t.from_id !== creator.id && t.to_id !== creator.id
    )
    const usd = trades.find((t: any) => t.token === 'USD')
    const shares = trades.find((t: any) => t.token !== 'USD')
    expect(usd).toMatchObject({ from_id: trader.id, to_id: holder.id, amount: 4 })
    expect(shares).toMatchObject({ from_id: holder.id, to_id: trader.id, amount: 40_000 })
    expect(usd.bundle).toBe(shares.bundle)
    expect((await bidsOn(cert.id))[0]).toMatchObject({ status: 'pending', amount: 6 })
    expect(await follows(cert.id, holder.id)).toBe(true)
    // X8 taken in full: accepted.
    expect((await accept(holder, bid, 6)).status).toBe(200)
    expect((await bidsOn(cert.id))[0]).toMatchObject({ status: 'accepted', amount: 0 })
  })
})

describe('X7 a new offer on an active certificate is matched against the other side', () => {
  // The holder offers 1% (100,000 shares) at a $1,000 valuation, i.e. $10, through the route (X5).
  async function sellOffer(projectId: string) {
    const r = await trade(holder, { projectId, amount: 100_000, buying: false, valuation: 1000 })
    expect(r.status).toBe(200)
    // Wait for its own webhook (following the project is its last step) before the next offer.
    expect(await until(() => follows(projectId, holder.id))).toBe(true)
  }
  standard('a buy offer at the same price or better trades at once, at the older offer’s valuation', async () => {
    const cert = await certificate()
    await sellOffer(cert.id)
    expect((await trade(trader, { projectId: cert.id, amount: 10, buying: true, valuation: 1200 })).status).toBe(200)
    const matched = await until(async () => {
      const bids = await bidsOn(cert.id)
      return bids.length === 2 && bids.every((b: any) => b.status === 'accepted') && bids
    })
    expect(matched).toBeTruthy()
    const trades = (await txnsOn(cert.id, 'user to user trade')).filter(
      (t: any) => t.from_id !== creator.id && t.to_id !== creator.id
    )
    expect(trades.find((t: any) => t.token === 'USD')).toMatchObject({
      from_id: trader.id,
      to_id: holder.id,
      amount: 10,
    })
    expect(trades.find((t: any) => t.token !== 'USD')).toMatchObject({
      from_id: holder.id,
      to_id: trader.id,
      amount: 100_000,
    })
  })
  standard('a buy offer below the asking price waits', async () => {
    const cert = await certificate()
    await sellOffer(cert.id)
    expect((await trade(trader, { projectId: cert.id, amount: 5, buying: true, valuation: 500 })).status).toBe(200)
    // Give the webhook time to act (it follows the bidder last), then check nothing traded.
    await until(() => follows(cert.id, trader.id))
    await Bun.sleep(500)
    expect((await bidsOn(cert.id)).map((b: any) => b.status)).toEqual(['pending', 'pending'])
    expect(await txnsOn(cert.id, 'user to user trade')).toHaveLength(2) // only the setup's
  })
})

describe('X11 grant evaluations', () => {
  const tiers = (projectId: string, tier: string) => [
    { id: 'unsorted', color: 'gray', projects: tier === 'unsorted' ? [{ id: projectId }] : [] },
    { id: '3', color: 'green', projects: tier === '3' ? [{ id: projectId }] : [] },
  ]
  const evalsOf = (who: string) =>
    sql`select project_id, score::float as score, confidence::float as confidence from project_evals
        where evaluator_id = ${who}`

  standard('the form is for signed-in people', async () => {
    const page = await evaluator.get('/evals-form')
    expect(found(page)).toBe(true)
    expect(page.text).toContain('Grant evaluation form')
    expect((await anonymous().get('/evals-form')).text).not.toContain('Grant evaluation form')
  })
  standard('saving replaces the person’s evaluations and trust; their page shows them', async () => {
    const project = await makeProject(sql, creator.id, 'active', `${RUN}-evaluated`)
    const save = (tier: string) =>
      evaluator.post('/api/save-evals', {
        tiers: tiers(project.id, tier),
        confidenceMap: { [project.id]: 0.8 },
        trustList: [{ profileId: holder.id, trust: 2 }],
      })
    expect((await save('3')).status).toBe(200)
    expect(await evalsOf(evaluator.id)).toEqual([{ project_id: project.id, score: 3, confidence: 0.8 }])
    expect(
      (await sql`select trusted_id, weight::float as weight from profile_trust where truster_id = ${evaluator.id}`) as unknown[]
    ).toEqual([{ trusted_id: holder.id, weight: 2 }])
    const page = await anonymous().get(`/${evaluator.username}/evals`)
    expect(found(page)).toBe(true)
    expect(page.text).toContain('Test evaluator')
    expect(page.text).toContain(`Test project ${RUN}`)
    // Put back in "unsorted": the evaluation goes.
    expect((await save('unsorted')).status).toBe(200)
    expect(await evalsOf(evaluator.id)).toHaveLength(0)
  })
})
