// A certificate's Shareholders tab (X9, docs/ai-reference/dormant/README.md), rendered to HTML: holdings come from the
// project's share txns, most first, without the market maker. Components render without
// `--conditions react-server`, so this lives here rather than in tests/unit.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { getShareholders } from '@/app/projects/[slug]/project-tabs'
import { Shareholders } from '@/app/projects/[slug]/shareholders'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

// Avatars use the app router; a do-nothing one is enough to render.
const router = {
  push() {},
  replace() {},
  refresh() {},
  prefetch() {},
  back() {},
  forward() {},
} as any

const PROJECT = 'project-1'
const profile = (id: string, type = 'individual') =>
  ({ id, username: `${id}-name`, full_name: `${id} Fullname`, avatar_url: null, type }) as any
const creator = profile('creator')
const buyer = profile('buyer')
const later = profile('later')
const amm = { ...profile(PROJECT, 'amm'), username: 'cert-amm', full_name: 'cert-amm' }

let n = 0
const txn = (
  from: any,
  to: string,
  token: string,
  amount: number,
  type: string,
  bundle: string | null
) =>
  ({
    id: `t${++n}`,
    from_id: from?.id ?? null,
    to_id: to,
    token,
    amount,
    type,
    bundle,
    project: PROJECT,
    profiles: from,
    created_at: `2024-01-0${Math.min(n, 9)}T00:00:00Z`,
  }) as any

const txns = [
  // All shares to the creator when the project is made.
  txn(null, creator.id, PROJECT, 10_000_000, 'mint cert', null),
  // The creator sells 10% to a buyer for $20.
  txn(creator, buyer.id, PROJECT, 1_000_000, 'user to user trade', 'b1'),
  txn(buyer, creator.id, 'USD', 20, 'user to user trade', 'b1'),
  // The creator seeds the market maker with 10% and $10.
  txn(creator, PROJECT, PROJECT, 1_000_000, 'inject amm liquidity', 'b2'),
  txn(creator, PROJECT, 'USD', 10, 'inject amm liquidity', 'b2'),
  // Someone buys 5% from the market maker.
  txn(later, PROJECT, 'USD', 10, 'user to amm trade', 'b3'),
  txn(amm, later.id, PROJECT, 500_000, 'user to amm trade', 'b3'),
]

describe('X9 the Shareholders tab lists holdings, most first, without the market maker', () => {
  test('holdings come from the share txns', () => {
    const held = Object.fromEntries(getShareholders(txns).map((s) => [s.profile.id, s.numShares]))
    expect(held).toEqual({
      [creator.id]: 8_000_000,
      [buyer.id]: 1_000_000,
      [later.id]: 500_000,
      [PROJECT]: 500_000,
    })
  })
  test('the tab shows people by holding, most first, and leaves out the market maker', () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <Shareholders
          shareholders={getShareholders(txns)}
          creator={creator}
          txns={txns}
          projectId={PROJECT}
          usingAmm={true}
        />
      </AppRouterContext.Provider>
    )
    const list = html.split('Trade history')[0]
    const order = [creator, buyer, later].map((p) => list.indexOf(p.full_name))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(list).not.toContain('cert-amm')
    expect(list).toContain('80%')
  })
})
