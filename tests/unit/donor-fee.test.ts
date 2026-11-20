// Donor fee: 5/105 of the part of lifetime deposits above $50k, in whole dollars, and a `fee` txn comes out of the
// donor's charity balance only (utils/math.ts). Local, no services needed.
import { describe, expect, test } from 'bun:test'
import { calculateDonorFee, getTxnCashMultiplierRaw, getTxnCharityMultiplier } from '@/utils/math'
import type { TxnAndProject } from '@/db/txn'

describe('donor fee amount', () => {
  test('nothing while lifetime deposits stay at or under $50k', () => {
    expect(calculateDonorFee(0, 40_000)).toBe(0)
    expect(calculateDonorFee(10_000, 40_000)).toBe(0)
  })
  test('only the part above $50k is charged, rounded down to the dollar', () => {
    // $20k of the $30k lands above the line: 20000 * 5/105 = 952.38
    expect(calculateDonorFee(40_000, 30_000)).toBe(952)
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
