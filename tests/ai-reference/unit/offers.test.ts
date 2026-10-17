// Offers and activation (docs/ai-reference/offers/README.md): what counts toward a proposal's minimum, and the numbers
// the project page shows. The activation itself is in tests/ai-reference/db/offers.test.ts.
import { describe, expect, test } from 'bun:test'
import { calcFundingNeeded, calcTotalOffered } from '@/utils/activate-project'
import { getAmountRaised, getMinIncludingAmm, getProposalValuation } from '@/utils/math'
import { donationLimitError, fundingLeft, MIN_DONATION } from '@/utils/donation-limits'

const CREATOR = 'creator'
let n = 0
const bid = (type: string, amount: number, status = 'pending', bidder = `donor${++n}`) =>
  ({
    id: `b${n}`,
    type,
    amount,
    status,
    bidder,
    valuation: 0,
    project: 'p',
    created_at: '2026-01-01',
  }) as any
const project = (fields: Record<string, unknown>, bids: any[] = []) =>
  ({
    id: 'p',
    creator: CREATOR,
    type: 'grant',
    stage: 'proposal',
    min_funding: 1000,
    funding_goal: 5000,
    founder_shares: 0,
    amm_shares: null,
    bids,
    ...fields,
  }) as any

describe('B9 a grant proposal counts its pending donate offers toward its minimum funding', () => {
  test('what is needed is the minimum funding', () => {
    expect(calcFundingNeeded(project({ min_funding: 750 }))).toBe(750)
  })
  test('only pending donate offers count', () => {
    const p = project({}, [
      bid('donate', 300),
      bid('donate', 200),
      bid('donate', 1000, 'declined'),
      bid('donate', 1000, 'deleted'),
      bid('donate', 1000, 'accepted'),
      bid('buy', 1000),
      bid('assurance buy', 1000),
    ])
    expect(calcTotalOffered(p)).toBe(500)
  })
  test('no offers, nothing offered', () => {
    expect(calcTotalOffered(project({}))).toBe(0)
  })
})

describe('B18 a certificate proposal needs what its creator asked for in assurance buy offers', () => {
  test("what is needed is the creator's own assurance sell offer", () => {
    const p = project({ type: 'cert' }, [
      bid('assurance sell', 400, 'pending', 'someone-else'),
      bid('assurance sell', 900, 'pending', CREATOR),
    ])
    expect(calcFundingNeeded(p)).toBe(900)
  })
  test('with no such offer, nothing is needed', () => {
    expect(calcFundingNeeded(project({ type: 'cert' }))).toBe(0)
  })
  test('only pending assurance buy offers count', () => {
    const p = project({ type: 'cert' }, [
      bid('assurance buy', 100),
      bid('assurance buy', 50),
      bid('assurance buy', 1000, 'declined'),
      bid('donate', 1000),
      bid('buy', 1000),
    ])
    expect(calcTotalOffered(p)).toBe(150)
  })
  test("valuation while a proposal: minimum funding / the investors' share of all shares", () => {
    // 10,000,000 shares: 6,000,000 to the founder and 1,000,000 to the market maker leave investors 30%.
    const p = project({
      type: 'cert',
      min_funding: 300,
      founder_shares: 6_000_000,
      amm_shares: 1_000_000,
    })
    expect(getProposalValuation(p)).toBeCloseTo(1000)
  })
})

describe('B16 while a proposal, the amount raised is the sum of its pending offers', () => {
  test('pending donate, buy and assurance buy offers count; others do not', () => {
    const bids = [
      bid('donate', 100),
      bid('buy', 20),
      bid('assurance buy', 3),
      bid('sell', 1000),
      bid('assurance sell', 1000),
      bid('donate', 1000, 'declined'),
      bid('donate', 1000, 'deleted'),
      bid('donate', 1000, 'accepted'),
    ]
    expect(getAmountRaised(project({}), bids, [])).toBe(123)
  })
  test('once active, txns count instead of offers', () => {
    const txns = [{ to_id: CREATOR, token: 'USD', amount: 40 }] as any[]
    expect(getAmountRaised(project({ stage: 'active' }), [bid('donate', 1000)], txns)).toBe(40)
  })
  test('a dummy project shows its funding goal', () => {
    expect(
      getAmountRaised(project({ type: 'dummy', funding_goal: 777 }), [bid('donate', 5)], [])
    ).toBe(777)
  })
})

describe('B17 the minimum shown', () => {
  test("a grant's is its minimum funding", () => {
    expect(getMinIncludingAmm(project({ min_funding: 1234 }))).toBe(1234)
  })
  test("a certificate's adds the market maker's share of the valuation", () => {
    const p = project({
      type: 'cert',
      min_funding: 300,
      founder_shares: 6_000_000,
      amm_shares: 1_000_000,
    })
    // valuation 1000 (see B18), market maker 10% of it
    expect(getMinIncludingAmm(p)).toBeCloseTo(400)
  })
})

describe('B20 B21 B22 the limits on giving to a grant project (shared by the donate boxes and the routes)', () => {
  test('what is left of the goal is the goal minus what was raised, never negative', () => {
    expect(fundingLeft(1000, 250)).toBe(750)
    expect(fundingLeft(1000, 1200)).toBe(0)
    expect(fundingLeft(100, 33.333)).toBe(66.67)
  })
  test('from $10 up to what is left', () => {
    expect(MIN_DONATION).toBe(10)
    expect(donationLimitError(10, 750)).toBeNull()
    expect(donationLimitError(750, 750)).toBeNull()
    expect(donationLimitError(9.99, 750)).toBe('The minimum is $10.')
    expect(donationLimitError(751, 750)).toBe(
      'This project needs $750 more to reach its funding goal, so you can give up to $750.'
    )
  })
  test('with less than $10 left, exactly what is left is allowed', () => {
    expect(donationLimitError(4.5, 4.5)).toBeNull()
    expect(donationLimitError(4, 4.5)).toBe(
      "The minimum is $4.50, what's left of the funding goal."
    )
    expect(donationLimitError(10, 4.5)).not.toBeNull()
  })
  test('nothing once the goal is reached', () => {
    expect(donationLimitError(10, 0)).toBe(
      'This project has reached its funding goal and is not accepting more donations.'
    )
  })
  test('no goal (a person or a fund): only the minimum', () => {
    expect(donationLimitError(1_000_000, null)).toBeNull()
    expect(donationLimitError(5, null)).toBe('The minimum is $10.')
  })
})
