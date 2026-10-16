// Runs the app's Stripe webhook, Mercury webhook and Mercury state machine in-process, for
// tests/ai-reference/db/deposits-withdrawals-flows.test.ts. A separate process because the app reads its settings when its
// modules load, and `bun test` shares one module cache between test files: here they load with the local stack's
// settings and fake Stripe/Mercury secrets.
//
// Never reaches an outside service: fetch goes to the local Supabase only; Mercury, Postmark and Discord get
// canned answers, recorded so the test can check what would have been sent. Anything else throws.
//
// Protocol: one JSON command per stdin line, {id, scenario, input}; one `RESULT <json>` stdout line per command.
import { Readable } from 'node:stream'
import { createHmac } from 'node:crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(supabaseUrl)) {
  throw new Error(`the harness only runs against a local Supabase, not ${supabaseUrl}`)
}

type Route = { method: string; path: string; status?: number; body: unknown }
type Call = { service: string; method: string; path: string; body: any }
let mercuryRoutes: Route[] = []
let calls: Call[] = []

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
  if (url.origin === new URL(supabaseUrl).origin) return realFetch(input, init)
  const body = typeof init?.body === 'string' ? safeJson(init.body) : init?.body
  if (url.hostname === 'api.mercury.com') {
    const path = url.pathname.replace(/^\/api\/v1/, '') + url.search
    calls.push({ service: 'mercury', method, path, body })
    const route = mercuryRoutes.find((r) => r.method === method && path.startsWith(r.path))
    if (!route) return new Response(`no fake for ${method} ${path}`, { status: 599 })
    const text = typeof route.body === 'string' ? route.body : JSON.stringify(route.body)
    return new Response(text, { status: route.status ?? 200, headers: { 'content-type': 'application/json' } })
  }
  if (url.hostname === 'api.postmarkapp.com') {
    calls.push({ service: 'postmark', method, path: url.pathname, body })
    return Response.json({ ErrorCode: 0, Message: 'OK (test)' })
  }
  if (url.hostname === 'discord.test') {
    calls.push({ service: 'discord', method, path: url.pathname, body })
    return new Response(null, { status: 204 })
  }
  throw new Error(`harness: refused a call to ${url.origin}`)
}) as typeof fetch

function safeJson(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

// A Pages Router request and response, enough for the two webhook handlers.
function fakeReqRes(raw: string, headers: Record<string, string>) {
  const req = Object.assign(Readable.from([Buffer.from(raw)]), { headers, method: 'POST' })
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
    json(b: unknown) {
      this.body = b
      return this
    },
    setHeader() {},
  }
  return { req, res }
}

const { createAdminClient } = await import('@/db/supabase-admin')
const admin = createAdminClient()

const scenarios: Record<string, (input: any) => Promise<unknown>> = {
  // Stripe calls our webhook with an event; `sign` false sends a bad signature.
  async 'stripe-webhook'(input: { event: object; sign?: boolean }) {
    const { stripe } = await import('@/utils/stripe')
    const handler = (await import('@/pages/api/stripe-endpoints')).default
    const payload = JSON.stringify(input.event)
    const signature =
      input.sign === false
        ? 't=1,v1=forged'
        : stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOKSECRET! })
    const { req, res } = fakeReqRes(payload, { 'stripe-signature': signature })
    await handler(req as any, res as any)
    return { status: res.statusCode, body: res.body }
  },

  // Mercury calls our webhook; `sign` false sends a bad signature, `ageSeconds` an old timestamp.
  async 'mercury-webhook'(input: { event: object; sign?: boolean; ageSeconds?: number }) {
    const handler = (await import('@/pages/api/mercury-endpoints')).default
    const payload = JSON.stringify(input.event)
    const t = Math.floor(Date.now() / 1000) - (input.ageSeconds ?? 0)
    const v1 =
      input.sign === false
        ? 'f'.repeat(64)
        : createHmac('sha256', process.env.MERCURY_WEBHOOK_SECRET!).update(`${t}.${payload}`).digest('hex')
    const { req, res } = fakeReqRes(payload, { 'mercury-signature': `t=${t},v1=${v1}` })
    await handler(req as any, res as any)
    return { status: res.statusCode, body: res.body }
  },

  // One sync of one request, as the hourly cron does it. `stale` overrides fields of the row as read, to act as a
  // caller that read the row before someone else moved it.
  async 'mercury-sync'(input: { requestId: string; stale?: Record<string, unknown> }) {
    const { syncWithdrawalRequest } = await import('@/utils/mercury-withdrawals')
    const { data } = await admin.from('withdrawal_requests').select('*').eq('id', input.requestId).single().throwOnError()
    await syncWithdrawalRequest(admin as any, { ...(data as any), ...(input.stale ?? {}) })
    return {}
  },

  async 'known-method'(input: { profileId: string; recipientId: string }) {
    const { getKnownPaymentMethod } = await import('@/db/withdrawal-request')
    return { method: await getKnownPaymentMethod(admin as any, input.profileId, input.recipientId) }
  },
}

for await (const line of console) {
  if (!line.trim()) continue
  const { id, scenario, input, mercury } = JSON.parse(line)
  mercuryRoutes = mercury ?? []
  calls = []
  let result: unknown
  let error: string | undefined
  try {
    result = await scenarios[scenario](input)
  } catch (e) {
    error = String(e instanceof Error ? e.message : e)
  }
  // Discord alerts and emails are sent without awaiting in places; let them land before reporting.
  await new Promise((r) => setTimeout(r, 20))
  console.log(`RESULT ${JSON.stringify({ id, result, error, calls })}`)
}
