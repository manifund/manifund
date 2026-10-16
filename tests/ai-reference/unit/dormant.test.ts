// Dormant features (docs/ai-reference/dormant/README.md): the market maker's pricing, the checks a trade must pass, and
// what a trade does to the offer it takes. The routes and pages are in route tests; the shareholders list is a
// component test (tests/ai-reference/components/dormant-shareholders.test.tsx).
import { describe, expect, test } from 'bun:test'
import {
  calculateAMMPorfolio,
  calculateBuyShares,
  calculateMinimumValuation,
  calculateSellPayout,
  calculateTradeForValuation,
  calculateValuation,
  calculateValuationAfterTrade,
  getTradeErrorMessage,
} from '@/utils/amm'
import { calculateSellableShares } from '@/utils/math'
import { updateBidFromTrade } from '@/utils/trade'

const SHARES = 10_000_000
// A market maker holding 1,000,000 shares and $20: valuation $200.
const AMM_SHARES = 1_000_000
const AMM_USD = 20

describe('X3 the market maker prices trades with a constant product', () => {
  test('its portfolio is what its txns brought in, shares and dollars apart', () => {
    const amm = 'project-1'
    const txns = [
      { from_id: 'creator', to_id: amm, token: amm, amount: AMM_SHARES },
      { from_id: 'creator', to_id: amm, token: 'USD', amount: AMM_USD },
      { from_id: 'buyer', to_id: amm, token: 'USD', amount: 5 },
      { from_id: amm, to_id: 'buyer', token: amm, amount: 200_000 },
      { from_id: 'someone', to_id: 'else', token: 'USD', amount: 99 },
    ] as any[]
    expect(calculateAMMPorfolio(txns, amm)).toEqual([800_000, 25])
  })
  test('valuation is dollars ÷ shares × 10,000,000', () => {
    expect(calculateValuation(AMM_SHARES, AMM_USD)).toBeCloseTo(200)
  })
  test('buying keeps dollars × shares the same, and raises the valuation', () => {
    const shares = calculateBuyShares(5, AMM_SHARES, AMM_USD)
    expect(shares).toBeGreaterThan(0)
    expect((AMM_USD + 5) * (AMM_SHARES - shares)).toBeCloseTo(AMM_USD * AMM_SHARES, 6)
    expect(calculateValuationAfterTrade(5, AMM_SHARES, AMM_USD, true)).toBeGreaterThan(200)
  })
  test('selling keeps dollars × shares the same, and lowers the valuation', () => {
    const payout = calculateSellPayout(100_000, AMM_SHARES, AMM_USD)
    expect(payout).toBeGreaterThan(0)
    expect(payout).toBeLessThan(AMM_USD)
    expect((AMM_USD - payout) * (AMM_SHARES + 100_000)).toBeCloseTo(AMM_USD * AMM_SHARES, 6)
    expect(calculateValuationAfterTrade(100_000, AMM_SHARES, AMM_USD, false)).toBeLessThan(200)
  })
  test('the trade that brings it to a valuation does reach it', () => {
    const [shares, usd] = calculateTradeForValuation(AMM_SHARES, AMM_USD, 300)
    expect(calculateValuation(AMM_SHARES - shares, AMM_USD - usd)).toBeCloseTo(300, 6)
  })
  test('the lowest valuation a limit order can name is dollars × shares ÷ 10,000,000', () => {
    expect(calculateMinimumValuation(AMM_SHARES, AMM_USD)).toBe((AMM_USD * AMM_SHARES) / SHARES)
  })
})

describe('X4 a trade is refused when it can’t be made', () => {
  // getTradeErrorMessage(mode, ammShares, ammUSD, spendable, sellableShares, isLimit, limitValuation, usd, equity)
  const market = (mode: 'buy' | 'sell', usd: number, equity: number, spendable = 100, sellable = 0) =>
    getTradeErrorMessage(mode, AMM_SHARES, AMM_USD, spendable, sellable, false, undefined, usd, equity)
  const limit = (mode: 'buy' | 'sell', valuation: number | undefined, amm = true) =>
    getTradeErrorMessage(
      mode,
      amm ? AMM_SHARES : 0,
      amm ? AMM_USD : 0,
      1000,
      SHARES,
      true,
      valuation,
      10,
      0.01
    )

  test('no amount', () => {
    expect(market('buy', 0, 0)).toBe('Please enter an amount')
  })
  test('a purchase over what the person can spend', () => {
    expect(market('buy', 101, 0.01, 100)).toBe('Insufficient funds')
    expect(market('buy', 100, 0.01, 100)).toBeUndefined()
  })
  test('a sale of more shares than the person can sell', () => {
    expect(market('sell', 1, 0.1, 100, 999_999)).toBe('Insufficient shares')
    expect(market('sell', 1, 0.1, 100, 1_000_000)).toBeUndefined()
  })
  test('a limit order needs a valuation', () => {
    expect(limit('buy', undefined)).toBe('Please enter a valuation')
  })
  test('with a market maker, a buy order can’t be above the current valuation, nor below the lowest', () => {
    expect(limit('buy', 250)).toBe('For buy limit orders, valuation must be less than current valuation')
    expect(limit('buy', 1)).toMatch(/^Valuation must be greater than/)
    expect(limit('buy', 150)).toBeUndefined()
  })
  test('with a market maker, a sell order can’t be below the current valuation', () => {
    expect(limit('sell', 150)).toBe(
      'For sell limit orders, valuation must be greater than current valuation'
    )
    expect(limit('sell', 250)).toBeUndefined()
  })
  test('without a market maker, any valuation will do', () => {
    expect(limit('buy', 1, false)).toBeUndefined()
    expect(limit('sell', 1, false)).toBeUndefined()
  })
  test('what a person can sell is the shares they hold', () => {
    const txns = [
      { from_id: null, to_id: 'me', token: 'p', amount: SHARES },
      { from_id: 'me', to_id: 'you', token: 'p', amount: 1_000_000 },
      { from_id: 'you', to_id: 'me', token: 'USD', amount: 50 },
    ] as any[]
    expect(calculateSellableShares(txns, [], 'p', 'me')).toBe(9_000_000)
  })
})

// A stand-in for the Supabase client: records the update updateBidFromTrade sends.
function fakeClient() {
  const calls: { update?: Record<string, unknown>; id?: string } = {}
  const client = {
    from: () => ({
      update: (row: Record<string, unknown>) => {
        calls.update = row
        return {
          eq: (_col: string, id: string) => {
            calls.id = id
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
  }
  return { client: client as any, calls }
}

describe('X8 after a trade, the offer’s amount goes down; taken in full, it’s accepted', () => {
  const offer = (amount: number) => ({ id: 'bid-1', amount, type: 'buy', valuation: 1000 }) as any
  test('taken in part: the rest stays pending', async () => {
    const { client, calls } = fakeClient()
    await updateBidFromTrade(offer(100), 40, client)
    expect(calls).toEqual({ update: { amount: 60, status: 'pending' }, id: 'bid-1' })
  })
  test('taken in full: accepted', async () => {
    const { client, calls } = fakeClient()
    await updateBidFromTrade(offer(100), 100, client)
    expect(calls.update).toEqual({ amount: 0, status: 'accepted' })
  })
})
