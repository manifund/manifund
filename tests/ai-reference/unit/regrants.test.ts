// Regrants (docs/ai-reference/regrants): how a grant's offer weighs on the regrantor's charity balance.
// The balance itself is the ledger's (utils/math); these tests only cover the regrant cases.
import { describe, expect, test } from 'bun:test'
import { calculateCharityBalance } from '@/utils/math'

const REGRANTOR = 'regrantor'
const GRANTEE = 'grantee'
const BANK = 'bank'
const PROJECT = 'project-1'

// The regrantor's budget arrives as a profile donation from Manifund's account.
const budget = (amount: number) =>
  ({
    from_id: BANK,
    to_id: REGRANTOR,
    amount,
    token: 'USD',
    type: 'profile donation',
    project: null,
    created_at: '2026-01-01T00:00:00Z',
    projects: null,
  }) as any
// The regrantor's offer on the grantee's project (what give_grant_v2 writes).
const offer = (amount: number, status: string, creator = GRANTEE) =>
  ({
    project: PROJECT,
    bidder: REGRANTOR,
    amount,
    status,
    type: 'donate',
    valuation: 0,
    projects: { creator, stage: status === 'pending' ? 'proposal' : 'active', type: 'grant' },
  }) as any
// What activate_proposal writes when the project activates: the offer becomes a project donation.
const donation = (amount: number) =>
  ({
    from_id: REGRANTOR,
    to_id: GRANTEE,
    amount,
    token: 'USD',
    type: 'project donation',
    project: PROJECT,
    created_at: '2026-02-01T00:00:00Z',
    projects: { creator: GRANTEE },
  }) as any

const balance = (txns: any[], bids: any[]) => calculateCharityBalance(txns, bids, REGRANTOR, false)

describe("G9 a grant offer on the grantee's project, from pending to activation", () => {
  test("a pending offer on the grantee's project holds its amount", () => {
    expect(balance([budget(10_000)], [offer(3_000, 'pending')])).toBe(7_000)
  })
  test('once the project activates (offer accepted, donation made), the donation counts once', () => {
    expect(balance([budget(10_000), donation(3_000)], [offer(3_000, 'accepted')])).toBe(7_000)
  })
  test('a declined offer (a rejected proposal, G14) holds nothing', () => {
    expect(balance([budget(10_000)], [offer(3_000, 'declined')])).toBe(10_000)
  })
  test('a $0 grant holds nothing', () => {
    expect(balance([budget(10_000)], [offer(0, 'pending')])).toBe(10_000)
  })
})
