// Deposits and withdrawals, the code that runs when Stripe or Mercury answers: docs/ai-reference/deposits-withdrawals/
// README.md, rules W2, W3, W5, W10, W17, W19-W22, W25.
//
// The Stripe webhook, the Mercury webhook and the Mercury state machine run in a child process
// (deposits-withdrawals.harness.ts) against the local database, with Stripe's signature made locally and
// Mercury's answers faked; nothing reaches Stripe, Mercury, Postmark or Discord. The test checks what was recorded
// (txns, withdrawal requests). The handlers write with their own clients, so rows are committed, not rolled back:
// they belong to this file's throwaway people and are deleted at the end.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { RUN } from '../helpers/content'
import { deleteTempUsers, person } from '../helpers/people'

type Call = { service: string; method: string; path: string; body: any }
type Out = { result: any; error?: string; calls: Call[] }
type Route = { method: string; path: string; status?: number; body: unknown }

let bank: string
let payer: string // deposits
let fund: string // an account card payments are passed on to
let grantee: string // withdrawals

// --- the child process ---------------------------------------------------------------------------------------
let child: ReturnType<typeof Bun.spawn> | undefined
const waiting = new Map<number, (o: Out) => void>()
let nextId = 0
let stderr = ''

async function startHarness() {
  child = Bun.spawn(
    [
      'bun',
      '--conditions',
      'react-server',
      join(import.meta.dir, 'deposits-withdrawals.harness.ts'),
    ],
    {
      cwd: join(import.meta.dir, '..', '..', '..'),
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        NODE_ENV: 'test',
        NEXT_PUBLIC_SUPABASE_ENV: 'dev', // isProd() false
        NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_URL_DEV: env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
        NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV: env.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: env.serviceKey,
        SUPABASE_SERVICE_ROLE_KEY_DEV: env.serviceKey,
        NEXT_PUBLIC_PROD_BANK_ID: bank,
        STRIPE_TEST_SECRET_KEY: 'sk_test_local_never_used',
        STRIPE_WEBHOOKSECRET: 'whsec_local_test',
        MERCURY_API_KEY: 'local-fake',
        MERCURY_GRANTS_ACCOUNT_ID: 'grants-account',
        MERCURY_WEBHOOK_SECRET: 'local-mercury-secret',
        POSTMARK_SERVER_TOKEN: '',
        DISCORD_ALERTS_WEBHOOK_URL: 'https://discord.test/alerts',
      },
    }
  )
  void (async () => {
    let buf = ''
    for await (const chunk of child!.stdout as unknown as AsyncIterable<Uint8Array>) {
      buf += new TextDecoder().decode(chunk)
      let i: number
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 1)
        if (!line.startsWith('RESULT ')) continue
        const { id, ...out } = JSON.parse(line.slice(7))
        waiting.get(id)?.(out)
        waiting.delete(id)
      }
    }
  })()
  void (async () => {
    for await (const chunk of child!.stderr as unknown as AsyncIterable<Uint8Array>)
      stderr += new TextDecoder().decode(chunk)
  })()
}

function run(scenario: string, input: unknown, mercury: Route[] = []): Promise<Out> {
  const id = ++nextId
  return new Promise<Out>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`harness timed out on ${scenario}:\n${stderr.slice(-2000)}`)),
      20_000
    )
    waiting.set(id, (o) => {
      clearTimeout(timer)
      resolve(o)
    })
    const stdin = child!.stdin as import('bun').FileSink
    stdin.write(JSON.stringify({ id, scenario, input, mercury }) + '\n')
    void stdin.flush()
  })
}

beforeAll(async () => {
  ;[{ id: bank }] = await sql`select id from profiles where username = 'Manifund-Bank'`
  payer = (await person('payer')).id
  fund = (await person('fund')).id
  grantee = (await person('grantee')).id
  await startHarness()
}, 30_000)

afterAll(async () => {
  child?.kill()
  const ids = [payer, fund, grantee].filter(Boolean)
  if (ids.length) {
    await sql`delete from stripe_txns where customer_id in ${sql(ids)}`
    await sql`delete from withdrawal_requests where profile_id in ${sql(ids)}`
  }
  await deleteTempUsers() // their txns and profiles
})

// --- Stripe deposits -----------------------------------------------------------------------------------------
const session = (s: {
  paid?: boolean
  amountTotal?: number
  metadataDollars?: string
  passFundsToId?: string
}) => {
  const sessionId = `cs_test_${RUN}_${++nextId}`
  return {
    sessionId,
    event: {
      id: `evt_${sessionId}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          payment_status: s.paid === false ? 'unpaid' : 'paid',
          amount_total: s.amountTotal ?? 2500,
          customer_details: { name: 'Test payer', email: 'payer@local.test' },
          metadata: {
            userId: payer,
            dollarQuantity: s.metadataDollars ?? String((s.amountTotal ?? 2500) / 100),
            ...(s.passFundsToId ? { passFundsToId: s.passFundsToId } : {}),
          },
        },
      },
    },
  }
}
const depositsFor = (sessionId: string) =>
  sql`select t.id, t.from_id, t.to_id, t.amount, t.type, s.amount as stripe_amount
      from stripe_txns s join txns t on t.id = s.txn_id where s.session_id = ${sessionId}`

describe('W2 deposits are credited only for paid, signed Stripe events', () => {
  test('a session completed but not paid yet records nothing', async () => {
    const s = session({ paid: false })
    const out = await run('stripe-webhook', { event: s.event })
    expect(out.result.status).toBe(200)
    expect(await depositsFor(s.sessionId)).toHaveLength(0)
  })
  test('an event without a valid Stripe signature is refused and records nothing', async () => {
    const s = session({})
    const out = await run('stripe-webhook', { event: s.event, sign: false })
    expect(out.result.status).toBe(400)
    expect(await depositsFor(s.sessionId)).toHaveLength(0)
  })
})

describe('W3 a deposit is a txn from the bank for what Stripe charged, linked to the session', () => {
  test('credits amount_total, not the amount the session was created with', async () => {
    const s = session({ amountTotal: 2500, metadataDollars: '30' })
    const out = await run('stripe-webhook', { event: s.event })
    expect(out.error).toBeUndefined()
    expect(out.result.status).toBe(200)
    const rows = await depositsFor(s.sessionId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ from_id: bank, to_id: payer, type: 'deposit' })
    expect(Number(rows[0].amount)).toBe(25)
    expect(Number(rows[0].stripe_amount)).toBe(25)
  })
  test('a session that charged nothing records nothing', async () => {
    const s = session({ amountTotal: 0 })
    const out = await run('stripe-webhook', { event: s.event })
    expect(out.error).toContain('amount_total 0')
    expect(await depositsFor(s.sessionId)).toHaveLength(0)
  })
})

describe('W5 a card payment to an account is a deposit to the payer, then a profile donation', () => {
  test('both txns, for the same amount', async () => {
    const before =
      await sql`select count(*)::int as n from txns where from_id = ${payer} and to_id = ${fund}`
    const s = session({ amountTotal: 4000, passFundsToId: fund })
    const out = await run('stripe-webhook', { event: s.event })
    expect(out.result.status).toBe(200)
    const [deposit] = await depositsFor(s.sessionId)
    expect(deposit).toMatchObject({ to_id: payer, type: 'deposit' })
    expect(Number(deposit.amount)).toBe(40)
    const given =
      await sql`select amount, type from txns where from_id = ${payer} and to_id = ${fund}`
    expect(given).toHaveLength(before[0].n + 1)
    expect(given.some((t: any) => t.type === 'profile donation' && Number(t.amount) === 40)).toBe(
      true
    )
  })
})

// --- Mercury withdrawals -------------------------------------------------------------------------------------
const RECIPIENT = `rcp-${RUN}`
const usRecipient = {
  id: RECIPIENT,
  name: 'Test grantee',
  status: 'active',
  address: { country: 'US' },
}
const indiaRecipient = { ...usRecipient, address: { country: 'IN' } }

// A Mercury withdrawal as the request route leaves it: a withdraw txn reserving the money, and the request.
async function openRequest(r: {
  status: string
  amount?: number
  method?: string
  fields?: Record<string, unknown>
}) {
  const amount = r.amount ?? 1500
  const [txn] = await sql`insert into txns (from_id, to_id, amount, token, type)
                          values (${grantee}, ${bank}, ${amount}, 'USD', 'withdraw') returning id`
  const [row] = await sql`
    insert into withdrawal_requests ${sql({
      profile_id: grantee,
      amount,
      payment_method: r.method ?? 'ach',
      status: r.status,
      txn_id: txn.id,
      ...(r.fields ?? {}),
    })}
    returning id, idempotency_key`
  return { id: row.id as string, key: row.idempotency_key as string, txn: txn.id as string }
}
const requestRow = async (id: string) =>
  (await sql`select * from withdrawal_requests where id = ${id}`)[0]
const txnExists = async (id: string) =>
  (await sql`select 1 from txns where id = ${id}`).length === 1
const mercury = (calls: Call[]) => calls.filter((c) => c.service === 'mercury')
const alerts = (calls: Call[]) =>
  calls.filter((c) => c.service === 'discord').map((c) => c.body.content as string)

beforeEach(async () => {
  if (!grantee) return
  await sql`delete from withdrawal_requests where profile_id = ${grantee}`
  await sql`delete from txns where from_id = ${grantee} and type = 'withdraw'`
  await sql`update profiles set mercury_recipient_id = null where id = ${grantee}`
})

describe('W19 bank details in: the payment is queued in Mercury for approval, once', () => {
  test('a completed invite saves the recipient and queues the payment with the request key and note', async () => {
    const r = await openRequest({
      status: 'awaiting_recipient',
      fields: { mercury_invite_id: 'inv-1' },
    })
    const out = await run('mercury-sync', { requestId: r.id }, [
      {
        method: 'GET',
        path: '/recipients/invites/inv-1',
        body: { id: 'inv-1', status: 'completed', recipientId: RECIPIENT },
      },
      { method: 'GET', path: `/recipient/${RECIPIENT}`, body: usRecipient },
      {
        method: 'POST',
        path: '/account/grants-account/request-send-money',
        body: {
          requestId: `smr-${RUN}-1`,
          status: 'pendingApproval',
          amount: 1500,
          recipientId: RECIPIENT,
        },
      },
    ])
    expect(out.error).toBeUndefined()
    const row = await requestRow(r.id)
    expect(row.status).toBe('pending_approval')
    expect(row.mercury_recipient_id).toBe(RECIPIENT)
    expect(row.mercury_request_id).toBe(`smr-${RUN}-1`)
    expect(row.submitted_at).not.toBeNull()
    const [{ mercury_recipient_id }] =
      await sql`select mercury_recipient_id from profiles where id = ${grantee}`
    expect(mercury_recipient_id).toBe(RECIPIENT) // W17: the next withdrawal skips onboarding
    const send = mercury(out.calls).find((c) => c.method === 'POST')!
    expect(send.body).toMatchObject({
      recipientId: RECIPIENT,
      amount: 1500,
      paymentMethod: 'ach',
      idempotencyKey: r.key,
      note: `mfw:${r.id}`,
    })
    expect(await txnExists(r.txn)).toBe(true) // still reserved
  })
  test('a retry Mercury refuses as a reused key recovers the payment already queued', async () => {
    const r = await openRequest({
      status: 'ready_to_pay',
      fields: { mercury_recipient_id: RECIPIENT },
    })
    await run('mercury-sync', { requestId: r.id }, [
      { method: 'GET', path: `/recipient/${RECIPIENT}`, body: usRecipient },
      {
        method: 'POST',
        path: '/account/grants-account/request-send-money',
        status: 400,
        body: { message: 'idempotency key already used' },
      },
      {
        method: 'GET',
        path: '/request-send-money',
        body: {
          requests: [
            {
              requestId: `smr-${RUN}-2`,
              status: 'pendingApproval',
              amount: 1500,
              recipientId: RECIPIENT,
            },
          ],
          page: {},
        },
      },
    ])
    const row = await requestRow(r.id)
    expect(row.status).toBe('pending_approval')
    expect(row.mercury_request_id).toBe(`smr-${RUN}-2`)
  })
})

describe('W20 India and the Philippines: a manual wire, marked sent when it shows up', () => {
  test('the request becomes needs_manual, nothing is sent through the API, the team is alerted', async () => {
    const r = await openRequest({
      status: 'ready_to_pay',
      method: 'internationalWire',
      fields: { mercury_recipient_id: RECIPIENT },
    })
    const out = await run('mercury-sync', { requestId: r.id }, [
      { method: 'GET', path: `/recipient/${RECIPIENT}`, body: indiaRecipient },
    ])
    expect((await requestRow(r.id)).status).toBe('needs_manual')
    expect(mercury(out.calls).some((c) => c.method === 'POST')).toBe(false)
    expect(alerts(out.calls).some((a) => a.includes('Manual wire needed'))).toBe(true)
    expect(await txnExists(r.txn)).toBe(true)
  })
  const wire = (id: string, amount: number, at = new Date(Date.now() + 60_000).toISOString()) => ({
    id,
    status: 'sent',
    amount,
    createdAt: at,
    postedAt: at,
    counterpartyId: RECIPIENT,
  })
  test('exactly one outgoing payment of that amount to that recipient marks it sent (money coming in is ignored)', async () => {
    const r = await openRequest({
      status: 'needs_manual',
      method: 'internationalWire',
      fields: { mercury_recipient_id: RECIPIENT },
    })
    await run('mercury-sync', { requestId: r.id }, [
      {
        method: 'GET',
        path: '/account/grants-account/transactions',
        body: { total: 2, transactions: [wire('mtx-in', 1500), wire('mtx-out', -1500)] },
      },
    ])
    const row = await requestRow(r.id)
    expect(row.status).toBe('sent')
    expect(row.mercury_transaction_id).toBe('mtx-out')
    expect(row.sent_at).not.toBeNull()
    expect(await txnExists(r.txn)).toBe(true) // the money is gone for good
  })
  test('two matching payments: nothing is guessed, the team is alerted', async () => {
    const r = await openRequest({
      status: 'needs_manual',
      method: 'internationalWire',
      fields: { mercury_recipient_id: RECIPIENT },
    })
    const out = await run('mercury-sync', { requestId: r.id }, [
      {
        method: 'GET',
        path: '/account/grants-account/transactions',
        body: { total: 2, transactions: [wire('mtx-a', -1500), wire('mtx-b', -1500)] },
      },
    ])
    expect((await requestRow(r.id)).status).toBe('needs_manual')
    expect(alerts(out.calls).some((a) => a.includes('matches 2'))).toBe(true)
  })
})

describe('W21 W10 outcomes: sent keeps the withdraw txn; rejected, expired or returned gives the money back', () => {
  const pending = () =>
    openRequest({
      status: 'pending_approval',
      fields: { mercury_recipient_id: RECIPIENT, mercury_request_id: `smr-${RUN}-${++nextId}` },
    })
  const approvals = (requestId: string, status: string) => [
    {
      method: 'GET',
      path: '/request-send-money',
      body: { requests: [{ requestId, status, amount: 1500, recipientId: RECIPIENT }], page: {} },
    },
  ]
  test('approved in Mercury: sent, with when', async () => {
    const r = await pending()
    const { mercury_request_id } = await requestRow(r.id)
    await run('mercury-sync', { requestId: r.id }, approvals(mercury_request_id, 'approved'))
    const row = await requestRow(r.id)
    expect(row.status).toBe('sent')
    expect(row.sent_at).not.toBeNull()
    expect(await txnExists(r.txn)).toBe(true)
  })
  for (const status of ['rejected', 'cancelled']) {
    test(`${status} in Mercury: rejected, the withdraw txn deleted, the reason kept`, async () => {
      const r = await pending()
      const { mercury_request_id } = await requestRow(r.id)
      await run('mercury-sync', { requestId: r.id }, approvals(mercury_request_id, status))
      const row = await requestRow(r.id)
      expect(row.status).toBe('rejected')
      expect(row.failure_reason).toContain(status)
      expect(row.txn_id).toBeNull()
      expect(await txnExists(r.txn)).toBe(false)
    })
  }
  test('invite expired without bank details: failed, the withdraw txn deleted', async () => {
    const r = await openRequest({
      status: 'awaiting_recipient',
      fields: { mercury_invite_id: 'inv-2' },
    })
    await run('mercury-sync', { requestId: r.id }, [
      {
        method: 'GET',
        path: '/recipients/invites/inv-2',
        body: { id: 'inv-2', status: 'expired' },
      },
    ])
    const row = await requestRow(r.id)
    expect(row.status).toBe('failed')
    expect(row.failure_reason).toBe('bank details were never submitted')
    expect(await txnExists(r.txn)).toBe(false)
  })
  test('still waiting (invite created, approval pending): nothing changes', async () => {
    const r = await openRequest({
      status: 'awaiting_recipient',
      fields: { mercury_invite_id: 'inv-3' },
    })
    await run('mercury-sync', { requestId: r.id }, [
      {
        method: 'GET',
        path: '/recipients/invites/inv-3',
        body: { id: 'inv-3', status: 'created' },
      },
    ])
    expect((await requestRow(r.id)).status).toBe('awaiting_recipient')
    expect(await txnExists(r.txn)).toBe(true)
  })
})

describe('W22 each transition happens once', () => {
  test('a caller that read the row before it was reversed cannot mark it sent', async () => {
    const r = await openRequest({
      status: 'pending_approval',
      fields: { mercury_recipient_id: RECIPIENT, mercury_request_id: `smr-${RUN}-x` },
    })
    await sql`update withdrawal_requests set status = 'rejected' where id = ${r.id}` // someone else reversed it
    const out = await run(
      'mercury-sync',
      { requestId: r.id, stale: { status: 'pending_approval' } },
      [
        {
          method: 'GET',
          path: '/request-send-money',
          body: {
            requests: [
              {
                requestId: `smr-${RUN}-x`,
                status: 'approved',
                amount: 1500,
                recipientId: RECIPIENT,
              },
            ],
            page: {},
          },
        },
      ]
    )
    expect((await requestRow(r.id)).status).toBe('rejected')
    expect(out.calls.filter((c) => c.service === 'postmark')).toHaveLength(0) // no "on its way" email
  })
  test('a caller that read the row before it was sent cannot reverse it', async () => {
    const r = await openRequest({
      status: 'pending_approval',
      fields: { mercury_recipient_id: RECIPIENT, mercury_request_id: `smr-${RUN}-y` },
    })
    await sql`update withdrawal_requests set status = 'sent', sent_at = now() where id = ${r.id}`
    await run('mercury-sync', { requestId: r.id, stale: { status: 'pending_approval' } }, [
      {
        method: 'GET',
        path: '/request-send-money',
        body: {
          requests: [
            { requestId: `smr-${RUN}-y`, status: 'rejected', amount: 1500, recipientId: RECIPIENT },
          ],
          page: {},
        },
      },
    ])
    expect((await requestRow(r.id)).status).toBe('sent')
    expect(await txnExists(r.txn)).toBe(true) // the money stays withdrawn
  })
  test('a reversed request is never turned back into sent by the webhook (the team is alerted)', async () => {
    const r = await openRequest({ status: 'failed', fields: { mercury_recipient_id: RECIPIENT } })
    const out = await run(
      'mercury-webhook',
      {
        event: {
          resourceType: 'transaction',
          resourceId: 'mtx-late',
          mergePatch: { status: 'sent' },
        },
      },
      [
        {
          method: 'GET',
          path: '/account/grants-account/transaction/mtx-late',
          body: { id: 'mtx-late', status: 'sent', amount: -1500, note: `mfw:${r.id}` },
        },
      ]
    )
    expect(out.result.status).toBe(200)
    expect((await requestRow(r.id)).status).toBe('failed')
    expect(alerts(out.calls).some((a) => a.includes('reconcile by hand'))).toBe(true)
  })
})

describe("W17 a returning withdrawer's method is the one their recipient was set up with", () => {
  test('the latest request with that recipient says which; another recipient says nothing', async () => {
    await sql`insert into withdrawal_requests (profile_id, amount, payment_method, status, mercury_recipient_id, requested_at)
              values (${grantee}, 2000, 'ach', 'sent', ${RECIPIENT}, now() - interval '30 days'),
                     (${grantee}, 1200, 'internationalWire', 'sent', ${RECIPIENT}, now() - interval '2 days')`
    expect(
      (await run('known-method', { profileId: grantee, recipientId: RECIPIENT })).result.method
    ).toBe('internationalWire')
    expect(
      (await run('known-method', { profileId: grantee, recipientId: 'rcp-other' })).result.method
    ).toBeNull()
  })
})

describe("W25 Mercury's webhook", () => {
  const event = (resourceId: string, status: string) => ({
    resourceType: 'transaction',
    resourceId,
    mergePatch: { status },
  })
  test('refused without a valid signature, or with one older than 5 minutes; the team is alerted', async () => {
    const r = await openRequest({ status: 'sent', fields: { mercury_recipient_id: RECIPIENT } })
    const tx = {
      method: 'GET',
      path: '/account/grants-account/transaction/mtx-r',
      body: { id: 'mtx-r', status: 'returned', amount: -1500, note: `mfw:${r.id}` },
    }
    for (const bad of [{ sign: false }, { ageSeconds: 301 }]) {
      const out = await run('mercury-webhook', { event: event('mtx-r', 'returned'), ...bad }, [tx])
      expect(out.result.status).toBe(400)
      expect(mercury(out.calls)).toHaveLength(0)
      expect(alerts(out.calls).some((a) => a.includes('signature verification failed'))).toBe(true)
    }
    expect((await requestRow(r.id)).status).toBe('sent')
  })
  test('a payment the bank returned: failed, and the money given back (W10, W21)', async () => {
    const r = await openRequest({ status: 'sent', fields: { mercury_recipient_id: RECIPIENT } })
    const out = await run('mercury-webhook', { event: event('mtx-ret', 'returned') }, [
      {
        method: 'GET',
        path: '/account/grants-account/transaction/mtx-ret',
        body: { id: 'mtx-ret', status: 'returned', amount: -1500, note: `mfw:${r.id}` },
      },
    ])
    expect(out.result.status).toBe(200)
    const row = await requestRow(r.id)
    expect(row.status).toBe('failed')
    expect(row.failure_reason).toContain('returned')
    expect(await txnExists(r.txn)).toBe(false)
  })
  test('a sent payment matched by recipient and amount when it has no note', async () => {
    const r = await openRequest({
      status: 'pending_approval',
      fields: { mercury_recipient_id: RECIPIENT, mercury_request_id: `smr-${RUN}-w` },
    })
    await sql`update profiles set mercury_recipient_id = ${RECIPIENT} where id = ${grantee}`
    await run('mercury-webhook', { event: event('mtx-sent', 'sent') }, [
      {
        method: 'GET',
        path: '/account/grants-account/transaction/mtx-sent',
        body: { id: 'mtx-sent', status: 'sent', amount: -1500, counterpartyId: RECIPIENT },
      },
    ])
    const row = await requestRow(r.id)
    expect(row.status).toBe('sent')
    expect(row.mercury_transaction_id).toBe('mtx-sent')
  })
  test("other activity on the account is ignored: statuses that aren't ours, other accounts' transactions", async () => {
    const r = await openRequest({
      status: 'pending_approval',
      fields: { mercury_recipient_id: RECIPIENT, mercury_request_id: `smr-${RUN}-z` },
    })
    const pendingEvent = await run('mercury-webhook', { event: event('mtx-p', 'pending') })
    expect(pendingEvent.result.status).toBe(200)
    expect(mercury(pendingEvent.calls)).toHaveLength(0) // not even looked up
    const otherAccount = await run('mercury-webhook', { event: event('mtx-o', 'sent') }, [
      {
        method: 'GET',
        path: '/account/grants-account/transaction/mtx-o',
        status: 403,
        body: { message: 'forbidden' },
      },
    ])
    expect(otherAccount.result.status).toBe(200)
    expect((await requestRow(r.id)).status).toBe('pending_approval')
  })
  test('when handling fails, it answers with an error so Mercury retries', async () => {
    const out = await run('mercury-webhook', { event: event('mtx-e', 'sent') }, [
      {
        method: 'GET',
        path: '/account/grants-account/transaction/mtx-e',
        status: 500,
        body: { message: 'down' },
      },
    ])
    expect(out.result.status).toBe(500)
  })
})
