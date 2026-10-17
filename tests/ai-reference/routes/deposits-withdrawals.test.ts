// Deposits and withdrawals through the app (docs/ai-reference/deposits-withdrawals/README.md): W1, W2, W4, W6, W8,
// W11-W14, W18, W23-W26. Locally Stripe's and Mercury's keys are blank and the network guard blocks both, so the
// routes are tested up to the point where they would call them, and for what they record (nothing, until then).
// The success paths run in tests/ai-reference/db/deposits-withdrawals-flows.test.ts (webhooks, Mercury's state machine) or are
// test.todo below. Only this file's own people; no admin calls.
import { beforeAll, describe, expect, test } from 'bun:test'
import { anonymous, type Client } from '../helpers/http'
import { person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { sql } from '../helpers/db'
import { RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

let bank: string
let donor: Client // charity money only (a deposit)
let grantee: Client // cash (a donation to their project)
let projectId: string

beforeAll(async () => {
  ;[{ id: bank }] = await sql`select id from profiles where username = 'Manifund-Bank'`
  donor = await person('donor')
  grantee = await person('grantee')
  await sql`insert into txns (from_id, to_id, amount, token, type) values (${bank}, ${donor.id}, 137, 'USD', 'deposit')`
  projectId = (await makeProject(sql, grantee.id, 'active', `${RUN}-dw`)).id
  await sql`insert into txns (from_id, to_id, amount, token, type, project)
            values (${bank}, ${grantee.id}, 2400, 'USD', 'project donation', ${projectId})`
}, 30_000)

const txnsOf = async (id: string, type: string) =>
  (await sql`select amount from txns where (from_id = ${id} or to_id = ${id}) and type = ${type}`).map((r: any) =>
    Number(r.amount)
  )
// The page's text without tags, so a label and its value read as "charity balance $137".
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
const stat = (html: string, label: string) => {
  const t = text(html)
  return t.match(new RegExp(`-?\\$[\\d,]+ ${label}`))?.[0] ?? t.match(new RegExp(`${label} -?\\$[\\d,]+`))?.[0] ?? ''
}

describe('W1 card deposits: a checkout session for the signed-in person', () => {
  smoke('visitors are refused', async () => {
    expect((await anonymous().post('/api/checkout-sessions', { dollarQuantity: 50 })).status).toBe(401)
  })
  standard('amounts the server refuses: zero, negative, not a number, over $1,000,000', async () => {
    for (const dollarQuantity of [0, -5, 'abc', null, 1_000_001]) {
      const r = await donor.post('/api/checkout-sessions', { dollarQuantity })
      expect(r.status).toBe(400)
      expect(r.body.error).toBe('Invalid amount')
    }
  })
  standard('asking for a session records no money: only the paid webhook does (W2, W3)', async () => {
    const before = await txnsOf(donor.id, 'deposit')
    const r = await donor.post('/api/checkout-sessions', { dollarQuantity: 50, userId: grantee.id })
    expect(r.status).not.toBe(200) // locally Stripe is out of reach
    expect(await txnsOf(donor.id, 'deposit')).toEqual(before)
    expect(await txnsOf(grantee.id, 'deposit')).toEqual([])
  })
  test.todo('W1 the session is created for the signed-in person, whatever userId the request sends (needs Stripe)', () => {})
  test.todo('W1 the deposit box asks for $10 to $50,000 (client-side modal, not in the page HTML; needs a browser test)', () => {})
})

describe("W2 Stripe's webhook needs Stripe's signature", () => {
  smoke('an unsigned call is refused and records nothing', async () => {
    const before = await txnsOf(donor.id, 'deposit')
    const r = await anonymous().post('/api/stripe-endpoints', {
      type: 'checkout.session.completed',
      data: { object: { id: `cs_${RUN}`, payment_status: 'paid', amount_total: 100000, metadata: { userId: donor.id } } },
    })
    expect(r.status).toBe(400)
    expect(await txnsOf(donor.id, 'deposit')).toEqual(before)
  })
})

describe('W4 deposited money is charity money', () => {
  standard("a deposit shows in the charity balance, not the cash balance, on the person's profile", async () => {
    const html = (await donor.get(`/${donor.username}`)).text
    expect(stat(html, 'charity balance')).toContain('$137')
    expect(stat(html, 'cash balance')).toContain('$0')
  })
  test.todo('W4 the deposit box says deposited money can be given, not withdrawn (client-side modal; needs a browser test)', () => {})
})

describe('W6 larger gifts go through forms outside the site', () => {
  test.todo('W6 the deposit box points to wire, crypto and DAFs, and from $10,000 suggests them (client-side modal; needs a browser test)', () => {})
})

describe('W8 only cash can be withdrawn; two ways', () => {
  smoke('/withdraw offers Stripe ("Small & US") and a bank transfer through Mercury ("Large or international")', async () => {
    const t = text((await grantee.get('/withdraw')).text)
    expect(t).toContain('Small & US')
    expect(t).toContain('Large or international')
    expect((await grantee.get('/withdraw')).text).toContain('href="/withdraw/request"')
  })
  standard('the Mercury page offers the cash balance; charity money alone is "nothing to withdraw"', async () => {
    expect(text((await donor.get('/withdraw/request')).text)).toContain('Nothing to withdraw')
    const t = text((await grantee.get('/withdraw/request')).text)
    expect(t).toContain('Withdraw to your bank')
    expect(t).toContain('$2,400')
  })
})

// Only a test.todo, so `bun run test:rules` shows the rule as still to test.
test.todo('W9 the withdraw txn is written first, then the balance re-checked (two at once: one refused with 409): both payout routes stop before that locally (Stripe account lookup blocked; Mercury refuses outside production)', () => {})

describe('W11 setting up a Stripe account', () => {
  standard('visitors are refused; a failed Stripe call saves no account id', async () => {
    expect((await anonymous().post('/api/create-connect-account', {})).status).toBeGreaterThanOrEqual(400)
    const r = await grantee.post('/api/create-connect-account', {})
    expect(r.status).toBeGreaterThanOrEqual(400) // Stripe is out of reach locally
    const [{ stripe_connect_id }] = await sql`select stripe_connect_id from profiles where id = ${grantee.id}`
    expect(stripe_connect_id).toBeNull()
  })
  test.todo('W11 an Express account with their email is created, saved on their profile, and they go to onboarding (needs Stripe)', () => {})
})

describe('W12 Stripe withdrawals: who and how much', () => {
  smoke('visitors are refused', async () => {
    const r = await anonymous().post('/api/stripe-connect-withdraw', { dollarAmount: 10 })
    expect(r.status).toBe(401)
    expect(r.body.error).toContain('signed in')
  })
  standard('someone without a Stripe account is told to set one up, and nothing is recorded', async () => {
    const r = await grantee.post('/api/stripe-connect-withdraw', { dollarAmount: 10 })
    expect(r.status).toBe(400)
    expect(r.body.error).toContain('Set up your Stripe account')
    expect(await txnsOf(grantee.id, 'withdraw')).toEqual([])
  })
  standard("with an account id that Stripe can't confirm (locally: unreachable), nothing is recorded", async () => {
    await sql`update profiles set stripe_connect_id = ${'acct_' + RUN} where id = ${grantee.id}`
    try {
      const r = await grantee.post('/api/stripe-connect-withdraw', { dollarAmount: 10 })
      expect(r.status).toBeGreaterThanOrEqual(400)
      expect(await txnsOf(grantee.id, 'withdraw')).toEqual([])
    } finally {
      await sql`update profiles set stripe_connect_id = null where id = ${grantee.id}`
    }
  })
  test.todo('W12 an account without payouts enabled is told to finish onboarding; an amount of 0 or over the cash balance is refused (checked after Stripe confirms the account: needs Stripe)', () => {})
})

// Only a test.todo, so `bun run test:rules` shows the rule as still to test.
test.todo('W13 a transfer to their account and a stripe_txns row; a failed transfer deletes the withdraw txn and alerts the team (needs Stripe)', () => {})

describe('W14 Mercury withdrawals run only in production', () => {
  smoke('outside production the request is refused, even with cash, and nothing is recorded', async () => {
    for (const who of [anonymous(), grantee]) {
      const r = await who.post('/api/mercury-withdraw', { dollarAmount: 1500, destination: 'us' })
      expect(r.status).toBe(403)
      expect(r.body.error).toContain('only available in production')
    }
    expect(await txnsOf(grantee.id, 'withdraw')).toEqual([])
    expect(await sql`select 1 from withdrawal_requests where profile_id = ${grantee.id}`).toHaveLength(0)
  })
  test.todo('W14 in production: refused without Mercury keys (503), and only admins while MERCURY_ENABLED is off; a request reserves the balance and creates the invite (needs production and Mercury)', () => {})
})

describe('W18 the withdrawal page shows the person their own request', () => {
  const withRequest = async (status: string, fields: Record<string, unknown>, fn: () => Promise<void>) => {
    const [row] = await sql`insert into withdrawal_requests ${sql({
      profile_id: grantee.id,
      amount: 1500,
      payment_method: 'ach',
      status,
      ...fields,
    })} returning id`
    try {
      await fn()
    } finally {
      await sql`delete from withdrawal_requests where id = ${row.id}`
    }
  }
  standard('waiting for bank details: "One step left", with the link to Mercury', () =>
    withRequest('awaiting_recipient', { mercury_onboarding_url: `https://app.mercury.com/invite/${RUN}` }, async () => {
      const html = (await grantee.get('/withdraw/request')).text
      expect(text(html)).toContain('One step left')
      expect(html).toContain(`https://app.mercury.com/invite/${RUN}`)
      expect(text((await donor.get('/withdraw/request')).text)).not.toContain('One step left') // nobody else's
    }))
  standard('queued: "Withdrawal in progress"', () =>
    withRequest('pending_approval', {}, async () => {
      expect(text((await grantee.get('/withdraw/request')).text)).toContain('Withdrawal in progress')
    }))
})

describe('W23 W24 the Mercury crons', () => {
  standard('outside production they do nothing (sync and nudge answer "not prod")', async () => {
    const sync = await anonymous().get('/api/mercury-sync')
    expect(sync.status).toBe(200)
    expect(sync.body).toBe('not prod')
    const nudge = await anonymous().get('/api/mercury-nudge')
    expect(nudge.status).toBe(200)
    expect(nudge.body).toBe('not prod')
  })
  test.todo('W23 the hourly sync needs the cron secret; ?requestId= refreshes only the signed-in person\'s own request (production only)', () => {})
  test.todo('W24 reminder emails after 24 hours then every 3 days; team alerts after 2 days then every 3 (production only)', () => {})
})

describe("W25 Mercury's webhook without a configured secret", () => {
  standard('answers 503 and records nothing', async () => {
    const r = await anonymous().post('/api/mercury-endpoints', { resourceType: 'transaction', resourceId: 'x', mergePatch: { status: 'sent' } })
    expect(r.status).toBe(503)
  })
})

describe('W26 moving cash to charity', () => {
  smoke('visitors are refused', async () => {
    expect((await anonymous().post('/api/move-cash-to-charity', { amount: 5 })).status).toBeGreaterThanOrEqual(400)
  })
  standard('under $1, or more than the cash balance, is refused and records nothing', async () => {
    for (const amount of [0.5, -10, 2401]) {
      expect((await grantee.post('/api/move-cash-to-charity', { amount })).status).toBeGreaterThanOrEqual(400)
    }
    expect((await donor.post('/api/move-cash-to-charity', { amount: 5 })).status).toBeGreaterThanOrEqual(400) // charity money only
    expect(await txnsOf(grantee.id, 'cash to charity transfer')).toEqual([])
    expect(await txnsOf(donor.id, 'cash to charity transfer')).toEqual([])
  })
  standard('a move is a "cash to charity transfer" from the person to themselves, and the profile shows it', async () => {
    const r = await grantee.post('/api/move-cash-to-charity', { amount: 400 })
    expect(r.status).toBe(200)
    const [row] = await sql`select from_id, to_id, amount from txns where to_id = ${grantee.id} and type = 'cash to charity transfer'`
    expect(row).toMatchObject({ from_id: grantee.id, to_id: grantee.id })
    expect(Number(row.amount)).toBe(400)
    const html = (await grantee.get(`/${grantee.username}`)).text
    expect(stat(html, 'cash balance')).toContain('$2,000')
    expect(stat(html, 'charity balance')).toContain('$400')
  })
})
