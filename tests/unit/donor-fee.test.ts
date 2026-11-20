// Donor fee: 5/105 of any deposit that takes lifetime deposits above $50k (a cliff), in whole dollars, and a `fee` txn comes out of the
// donor's charity balance only (utils/math.ts). Local, no services needed.
import { describe, expect, test } from 'bun:test'
import { calculateDonorFee, getTxnCashMultiplierRaw, getTxnCharityMultiplier } from '@/utils/math'
import type { TxnAndProject } from '@/db/txn'

describe('donor fee amount', () => {
  test('nothing while lifetime deposits stay at or under $50k', () => {
    expect(calculateDonorFee(0, 40_000)).toBe(0)
    expect(calculateDonorFee(10_000, 40_000)).toBe(0)
  })
  test('crossing $50k charges the whole deposit, rounded down to the dollar', () => {
    // 52500 * 5/105 = 2500
    expect(calculateDonorFee(0, 52_500)).toBe(2_500)
    // 30000 * 5/105 = 1428.57
    expect(calculateDonorFee(40_000, 30_000)).toBe(1_428)
  })
  test('landing exactly on $50k is not over the line', () => {
    expect(calculateDonorFee(0, 50_000)).toBe(0)
    expect(calculateDonorFee(49_999, 1)).toBe(0)
  })
  test('a donor already over the line pays on the whole deposit', () => {
    expect(calculateDonorFee(60_000, 105_000)).toBe(5_000)
  })
  test('withdrawals and zero amounts have no fee', () => {
    expect(calculateDonorFee(100_000, -500)).toBe(0)
    expect(calculateDonorFee(100_000, 0)).toBe(0)
  })
})

describe('fee txn balances', () => {
  const fee = {
    id: 't1',
    amount: 5_000,
    from_id: 'donor',
    to_id: 'bank',
    token: 'USD',
    type: 'fee',
    created_at: '2026-11-20T00:00:00Z',
    projects: null,
  } as unknown as TxnAndProject

  test('comes out of the donor charity balance', () => {
    expect(getTxnCharityMultiplier(fee, 'donor', false)).toBe(-1)
  })
  test('does not touch the donor cash balance, even if accredited', () => {
    expect(getTxnCashMultiplierRaw(fee, 'donor', null, false)).toBe(0)
    expect(getTxnCashMultiplierRaw(fee, 'donor', null, true)).toBe(0)
  })
})
