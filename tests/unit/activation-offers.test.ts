// Before a project activates, every pending funding offer must still be covered by its offerer's
// balance (utils/activate-project.ts). Local, no services needed.
import { describe, expect, test } from 'bun:test'
import { uncoveredOffers } from '@/utils/activate-project'
import type { Bid } from '@/db/bid'
import type { ProjectAndBids } from '@/db/project'

const bid = (id: string, bidder: string, amount: number, extra: Partial<Bid> = {}) =>
  ({
    id,
    bidder,
    amount,
    status: 'pending',
    type: 'donate',
    project: 'p1',
    ...extra,
  }) as Bid

const grant = (bids: Bid[]) => ({ id: 'p1', type: 'grant', bids }) as unknown as ProjectAndBids

describe('offers are re-checked against balances before activation', () => {
  test('offers their bidders can cover are kept', () => {
    const project = grant([bid('a', 'ann', 500), bid('b', 'bo', 200)])
    const available = new Map([
      ['ann', 500],
      ['bo', 1000],
    ])
    expect(uncoveredOffers(project, available)).toEqual([])
  })
  test("a bidder's offers on the project are summed against their balance", () => {
    const project = grant([bid('a', 'ann', 300), bid('b', 'ann', 300), bid('c', 'bo', 50)])
    const available = new Map([
      ['ann', 500],
      ['bo', 50],
    ])
    expect(uncoveredOffers(project, available).map((b) => b.id)).toEqual(['a', 'b'])
  })
  test('a bidder with no balance at all is not covered', () => {
    const project = grant([bid('a', 'ann', 1_000_000)])
    expect(uncoveredOffers(project, new Map()).map((b) => b.id)).toEqual(['a'])
  })
  test('only pending funding offers count', () => {
    const project = grant([
      bid('a', 'ann', 900, { status: 'declined' }),
      bid('b', 'ann', 900, { type: 'buy' }),
      bid('c', 'ann', 100),
    ])
    expect(uncoveredOffers(project, new Map([['ann', 100]]))).toEqual([])
  })
  test('certificates check assurance buy offers', () => {
    const project = {
      id: 'p1',
      type: 'cert',
      bids: [
        bid('a', 'ann', 400, { type: 'assurance buy' }),
        bid('b', 'cy', 400, { type: 'assurance sell' }),
      ],
    } as unknown as ProjectAndBids
    expect(uncoveredOffers(project, new Map([['ann', 100]])).map((b) => b.id)).toEqual(['a'])
  })
})
