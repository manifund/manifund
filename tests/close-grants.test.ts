import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { differenceInDays } from 'date-fns'
import { NextRequest } from 'next/server'

// close-grants is a Vercel Edge cron that rejects under-funded non-auction
// proposals and emails the creator, bidders, and followers. These tests guard
// the bidder OFFER_RESOLVED loop against regressing back to a fire-and-forget
// `forEach(async ...)`, which silently dropped sends on the Edge runtime
// (un-awaited promises have no lifetime guarantee after the handler returns)
// and turned any Postmark/Supabase failure into an unhandled rejection.

// Mutable test state, hoisted so vi.mock factories can read/write it.
// vi.mock factories are hoisted above all imports, so any values they close
// over must also be hoisted.
const mockState = vi.hoisted(() => ({
  projects: [] as any[],
  rpcResult: { error: null } as any,
  prizeCause: undefined as any,
  isProdValue: true,
  sendCalls: [] as any[],
  sendImpl: null as null | ((...args: any[]) => any),
}))

// Stub the Postmark email path. The bidder-loop fix lives at the call site;
// this mock records every send (template id, model, recipient) so tests can
// assert counts, payloads, and awaiting behavior.
vi.mock('@/utils/email', () => ({
  TEMPLATE_IDS: {
    GENERIC_NOTIF: 32825293,
    GENERIC_NOTIF_HTML: 34725473,
    VERDICT: 31974162,
    NEW_COMMENT: 31316102,
    COMMENT_WITH_MENTION: 31350406,
    CREATOR_UPDATE: 31328698,
    NEW_USER_GRANT: 31479155,
    EXISTING_USER_GRANT: 31480376,
    CASH_TO_CHARITY: 32471388,
    CONFIRM_WITHDRAWAL: 32048469,
    PAYMENT_CONFIRMATION: 31316115,
    PROJECT_DONATION: 31534853,
    REGRANTER_DONATION: 31571248,
    TRADE_ACCEPTED: 31316920,
    OFFER_RESOLVED: 31316141,
    AUCTION_RESOLVED: 31316142,
  },
  sendTemplateEmail: async (
    templateId: number,
    templateModel: any,
    toId?: any,
    toEmail?: any,
    fromEmail?: any
  ) => {
    mockState.sendCalls.push({ templateId, templateModel, toId, toEmail, fromEmail })
    if (mockState.sendImpl) {
      return mockState.sendImpl(templateId, templateModel, toId, toEmail, fromEmail)
    }
    return undefined
  },
}))

// Stub resolveAuction so auction projects don't run the real (heavy) path.
vi.mock('@/utils/resolve-auction', () => ({
  resolveAuction: async () => undefined,
}))

// checkReactivateEligible is a pure fn; stub returns false.
vi.mock('@/utils/activate-project', () => ({
  checkReactivateEligible: () => false,
}))

// getPrizeCause would hit Supabase; stub returns a configurable cause.
vi.mock('@/db/cause', () => ({
  getPrizeCause: async () => mockState.prizeCause,
}))

vi.mock('@/db/env', () => ({
  isProd: () => mockState.isProdValue,
}))

// Stub @/utils/amm so @/utils/math loads without importing the React chart.
// calculateAMMPorfolio/calculateValuation are only used in the
// active-valuation branch; proposal-stage code never calls them.
vi.mock('@/utils/amm', () => ({
  calculateAMMPorfolio: () => [0, 0],
  calculateValuation: () => 0,
}))

// Supabase admin client mock. close-grants uses .from('projects') (thenable)
// and .rpc('reject_proposal', ...). We expose a fluent thenable builder.
vi.mock('@/db/edge', () => {
  const makeBuilder = (data: any[]) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      neq: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      maybeSingle: () => builder,
      match: () => builder,
      throwOnError: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      // Thenable: `await supabase.from('projects').select(...).eq(...)` resolves
      // to { data, error }.
      then: (resolve: any) => resolve({ data, error: null }),
    }
    return builder
  }
  return {
    createAdminClient: () => ({
      from: () => makeBuilder(mockState.projects),
      rpc: async () => mockState.rpcResult,
    }),
  }
})

// Import the handler AFTER mocks are registered.
import handler from '@/pages/api/close-grants'

const T_VERDICT = 31974162
const T_GENERIC_NOTIF = 32825293
const T_OFFER_RESOLVED = 31316141

// Find an auction_close date that passes the weekly gate
// (differenceInDays(now, closeDate) >= 0 && % 7 === 0).
function findAuctionClose(): string {
  const now = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const iso = d.toISOString().slice(0, 10)
    const closeDate = new Date(`${iso}T23:59:59-07:00`)
    const diff = differenceInDays(now, closeDate)
    if (diff >= 0 && diff % 7 === 0) return iso
  }
  throw new Error('could not find an auction_close that passes the weekly gate')
}

const AUCTION_CLOSE = findAuctionClose()

function makeProject(overrides: Record<string, any> = {}) {
  return {
    id: 'p1',
    slug: 'test-project',
    title: 'Test Project',
    creator: 'creator1',
    stage: 'proposal',
    type: 'cert',
    min_funding: 1000,
    funding_goal: 1000,
    founder_shares: 0,
    amm_shares: null,
    approved: false,
    signed_agreement: false,
    alerts_paused: false,
    auction_close: AUCTION_CLOSE,
    round: 'r1',
    ai_fraction: null,
    blurb: null,
    created_at: '2026-01-01T00:00:00Z',
    description: null,
    external_link: null,
    lobbying: false,
    location_description: null,
    markets: null,
    public_benefit: null,
    quality_score: null,
    profiles: { full_name: 'Creator Name' },
    causes: [{ slug: 'cause1' }],
    project_follows: [] as any[],
    bids: [] as any[],
    ...overrides,
  }
}

function makeBid(bidder: string, overrides: Record<string, any> = {}) {
  return {
    id: `bid-${bidder}-${Math.random().toString(36).slice(2)}`,
    bidder,
    project: 'p1',
    amount: 100,
    valuation: 1000,
    status: 'pending',
    type: 'assurance buy',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeReq() {
  return new NextRequest('http://localhost/api/close-grants', {
    headers: { authorization: 'Bearer test-cron-secret' },
  })
}

describe('close-grants bidder email dispatch', () => {
  beforeEach(() => {
    mockState.projects = []
    mockState.rpcResult = { error: null }
    mockState.prizeCause = undefined
    mockState.isProdValue = true
    mockState.sendCalls = []
    mockState.sendImpl = null
    process.env.CRON_SECRET = 'test-cron-secret'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends one OFFER_RESOLVED per unique bidder with the declined payload', async () => {
    const project = makeProject({
      bids: [makeBid('b1'), makeBid('b2'), makeBid('b2'), makeBid('b3')],
    })
    mockState.projects = [project]

    await handler(makeReq())

    const offerCalls = mockState.sendCalls.filter((c) => c.templateId === T_OFFER_RESOLVED)
    expect(offerCalls).toHaveLength(3)
    expect(offerCalls.map((c) => c.toId)).toEqual(['b1', 'b2', 'b3'])
    for (const call of offerCalls) {
      expect(call.templateModel).toEqual({
        projectTitle: 'Test Project',
        result: 'declined',
        projectUrl: 'https://manifund.org/projects/test-project',
        auctionResolutionText:
          'This project was not funded, because it received only $400 in funding, which is less than its minimum funding goal of $1000.',
        bidResolutionText: 'Your offer was declined.',
      })
    }
  })

  it('awaits every bidder send before returning (no fire-and-forget)', async () => {
    const project = makeProject({
      bids: [makeBid('b1'), makeBid('b2'), makeBid('b3'), makeBid('b4'), makeBid('b5')],
      project_follows: [],
    })
    mockState.projects = [project]

    let inFlight = 0
    mockState.sendImpl = () => {
      inFlight++
      return new Promise<void>((resolve) => {
        // macrotask resolution — only fires after the current task ends,
        // so a fire-and-forget caller will have exited before this runs.
        setTimeout(() => {
          inFlight--
          resolve()
        }, 0)
      })
    }

    await handler(makeReq())

    // A fire-and-forget `forEach(async)` leaves all bidder sends pending here
    // (inFlight === 5); the awaited `for...of` drains each before returning.
    expect(inFlight).toBe(0)
  })

  it('propagates a failing bidder send instead of swallowing it', async () => {
    const project = makeProject({
      bids: [makeBid('b1'), makeBid('b2'), makeBid('b3')],
      project_follows: [{ follower_id: 'f1' }],
    })
    mockState.projects = [project]

    let unhandled = false
    const onUnhandled = () => {
      unhandled = true
    }
    process.on('unhandledRejection', onUnhandled)

    try {
      mockState.sendImpl = (_t: number, _m: any, toId?: any) => {
        if (toId === 'b2') return Promise.reject(new Error('postmark 500'))
        return Promise.resolve(undefined)
      }

      await expect(handler(makeReq())).rejects.toThrow('postmark 500')

      // Give the event loop a tick to surface any unhandled rejection.
      await new Promise((r) => setTimeout(r, 50))
      expect(unhandled).toBe(false)

      // The creator VERDICT send completed before the bidder loop threw.
      expect(mockState.sendCalls.filter((c) => c.templateId === T_VERDICT)).toHaveLength(1)
      // The follower send must NOT have fired (throw skipped it).
      expect(mockState.sendCalls.filter((c) => c.templateId === T_GENERIC_NOTIF)).toHaveLength(0)
    } finally {
      process.removeListener('unhandledRejection', onUnhandled)
    }
  })
})
