// Balances computed from the ledger (utils/math.ts): docs/ai-reference/ledger/README.md, rules L1, L5-L7, L9, L17,
// L18, L21.
// Pure logic: hand-made txns and offers, no database.
import { describe, expect, test } from 'bun:test'
import {
  calculateCashBalance,
  calculateCharityBalance,
  calculateUserBalance,
  getAmountRaised,
} from '@/utils/math'
import { userBalances } from '@/app/admin/utils'
import { getTransfersByEmail } from '@/db/project-transfer'

const ME = 'me'
const OTHER = 'other'
const BANK = 'bank'
const AFTER = '2025-06-01T00:00:00Z'

let n = 0
type T = {
  from?: string | null
  to: string
  amount: number
  type: string
  token?: string
  projectCreator?: string
  at?: string
  id?: string
}
const txn = (t: T) =>
  ({
    id: t.id ?? `txn-${++n}`,
    from_id: t.from === undefined ? BANK : t.from,
    to_id: t.to,
    amount: t.amount,
    token: t.token ?? 'USD',
    type: t.type,
    created_at: t.at ?? AFTER,
    project: t.projectCreator ? 'project-1' : null,
    bundle: null,
    projects: t.projectCreator ? { creator: t.projectCreator, stage: 'active', type: 'grant' } : undefined,
  }) as any

const bid = (b: { amount: number; type?: string; status?: string; creator: string; stage?: string; bidder?: string }) =>
  ({
    amount: b.amount,
    type: b.type ?? 'donate',
    status: b.status ?? 'pending',
    bidder: b.bidder ?? ME,
    projects: { creator: b.creator, stage: b.stage ?? 'proposal', type: 'grant' },
  }) as any

// The three numbers a profile shows, for ME.
const balances = (txns: any[], bids: any[] = []) => ({
  total: calculateUserBalance(txns, ME),
  charity: calculateCharityBalance(txns, bids, ME, false),
  cash: calculateCashBalance(txns, bids, ME, false),
})

describe('L1 balances are computed from the txns, each time', () => {
  test('no txns, no money; each txn adds to what the balances say', () => {
    expect(balances([])).toEqual({ total: 0, charity: 0, cash: 0 })
    const txns = [txn({ to: ME, amount: 100, type: 'deposit' })]
    expect(balances(txns)).toEqual({ total: 100, charity: 100, cash: 0 })
    txns.push(txn({ from: ME, to: OTHER, amount: 30, type: 'profile donation' }))
    expect(balances(txns)).toEqual({ total: 70, charity: 70, cash: 0 })
  })
  test("charity and cash ignore other people's txns; the total is computed from the person's own txns", () => {
    // Callers fetch a person's txns (from_id or to_id = them, db/txn.ts) before computing the total.
    const theirs = txn({ from: OTHER, to: 'third', amount: 50, type: 'profile donation' })
    expect(balances([theirs])).toMatchObject({ charity: 0, cash: 0 })
  })
})

describe('L5 total balance: USD received minus USD sent', () => {
  test('received minus sent, whatever the type', () => {
    const txns = [
      txn({ to: ME, amount: 500, type: 'deposit' }),
      txn({ from: OTHER, to: ME, amount: 200, type: 'project donation', projectCreator: ME }),
      txn({ from: ME, to: BANK, amount: 50, type: 'withdraw' }),
      txn({ from: ME, to: OTHER, amount: 25, type: 'tip' }),
    ]
    expect(calculateUserBalance(txns, ME)).toBe(500 + 200 - 50 - 25)
  })
  test('a txn to oneself counts zero, and share txns (non-USD) not at all', () => {
    const txns = [
      txn({ to: ME, amount: 100, type: 'deposit' }),
      txn({ from: ME, to: ME, amount: 40, type: 'cash to charity transfer' }),
      txn({ from: null, to: ME, amount: 10_000_000, type: 'mint cert', token: 'project-1' }),
    ]
    expect(calculateUserBalance(txns, ME)).toBe(100)
  })
  test("pending offers don't reduce the total (they show as \"in pending offers\")", () => {
    const txns = [txn({ to: ME, amount: 100, type: 'deposit' })]
    const b = balances(txns, [bid({ amount: 30, creator: OTHER })])
    expect(b.total).toBe(100)
    expect(b.total - b.charity - b.cash).toBe(30)
  })
})

describe('L6 what moves the charity balance', () => {
  const up = ['deposit', 'profile donation', 'tip', 'mana deposit', 'return bank funds']
  for (const type of up) {
    test(`receiving a ${type} adds to charity, not cash`, () => {
      expect(balances([txn({ from: OTHER, to: ME, amount: 10, type })])).toMatchObject({ charity: 10, cash: 0 })
    })
  }
  for (const type of ['project donation', 'profile donation', 'tip']) {
    test(`sending a ${type} takes from charity, not cash`, () => {
      const t = txn({ from: ME, to: OTHER, amount: 10, type, projectCreator: type === 'project donation' ? OTHER : undefined })
      expect(balances([t])).toMatchObject({ charity: -10, cash: 0 })
    })
  }
  test('moving cash to charity adds to charity and takes from cash', () => {
    expect(balances([txn({ from: ME, to: ME, amount: 10, type: 'cash to charity transfer' })])).toEqual({
      total: 0,
      charity: 10,
      cash: -10,
    })
  })
  test("withdrawals don't touch charity", () => {
    expect(balances([txn({ from: ME, to: BANK, amount: 10, type: 'withdraw' })])).toMatchObject({ charity: 0 })
  })
})

describe('L7 what moves the cash balance', () => {
  test('a project donation received adds to cash, not charity', () => {
    const t = txn({ from: OTHER, to: ME, amount: 1000, type: 'project donation', projectCreator: ME })
    expect(balances([t])).toEqual({ total: 1000, charity: 0, cash: 1000 })
  })
  test('a withdrawal takes from cash', () => {
    const txns = [
      txn({ from: OTHER, to: ME, amount: 1000, type: 'project donation', projectCreator: ME }),
      txn({ from: ME, to: BANK, amount: 400, type: 'withdraw' }),
    ]
    expect(balances(txns)).toEqual({ total: 600, charity: 0, cash: 600 })
  })
  for (const type of ['deposit', 'profile donation', 'tip', 'return bank funds']) {
    test(`a ${type} received doesn't touch cash`, () => {
      expect(balances([txn({ from: OTHER, to: ME, amount: 10, type })]).cash).toBe(0)
    })
  }
})

describe('L9 pending offers set money aside', () => {
  const deposit = [txn({ to: ME, amount: 100, type: 'deposit' })]
  test("an offer on someone else's project comes off charity", () => {
    for (const type of ['donate', 'buy', 'assurance buy']) {
      expect(balances(deposit, [bid({ amount: 30, type, creator: OTHER })])).toMatchObject({ charity: 70, cash: 0 })
    }
  })
  test('offers to sell and offers no longer pending set nothing aside', () => {
    const none = [
      bid({ amount: 30, type: 'sell', creator: OTHER }),
      bid({ amount: 30, type: 'assurance sell', creator: OTHER }),
      bid({ amount: 30, status: 'accepted', creator: OTHER }),
      bid({ amount: 30, status: 'declined', creator: ME }),
    ]
    expect(balances(deposit, none)).toMatchObject({ charity: 100, cash: 0 })
  })
})

describe('L17 what a project has raised', () => {
  const project = (stage: string, type = 'grant') =>
    ({ id: 'project-1', creator: 'creator', stage, type, funding_goal: 5000 }) as any
  test("past proposal: the USD txns on the project to its creator (not shares, not others')", () => {
    const txns = [
      txn({ from: 'a', to: 'creator', amount: 100, type: 'project donation', projectCreator: 'creator' }),
      txn({ from: 'b', to: 'creator', amount: 250, type: 'project donation', projectCreator: 'creator' }),
      txn({ from: null, to: 'creator', amount: 10_000_000, type: 'mint cert', token: 'project-1' }),
      txn({ from: 'creator', to: 'c', amount: 40, type: 'user to user trade', projectCreator: 'creator' }),
    ]
    expect(getAmountRaised(project('active'), [], txns)).toBe(350)
    expect(getAmountRaised(project('complete'), [], txns)).toBe(350)
  })
  test('in proposal: its pending offers to buy or donate', () => {
    const bids = [
      { amount: 100, type: 'donate', status: 'pending' },
      { amount: 50, type: 'assurance buy', status: 'pending' },
      { amount: 20, type: 'buy', status: 'pending' },
      { amount: 999, type: 'donate', status: 'declined' },
      { amount: 999, type: 'sell', status: 'pending' },
    ] as any[]
    expect(getAmountRaised(project('proposal'), bids, [])).toBe(170)
  })
  test('a "dummy" project shows its funding goal', () => {
    expect(getAmountRaised(project('active', 'dummy'), [], [])).toBe(5000)
  })
})

describe('L21 /finances shows each account its total balance', () => {
  test("the page's balances (app/admin/utils userBalances) are the profiles' total balances (L5)", () => {
    const txns = [
      txn({ to: ME, amount: 500, type: 'deposit' }),
      txn({ from: ME, to: OTHER, amount: 120, type: 'profile donation' }),
      txn({ from: OTHER, to: ME, amount: 70, type: 'project donation', projectCreator: ME }),
      txn({ from: ME, to: ME, amount: 30, type: 'cash to charity transfer' }),
      txn({ from: ME, to: BANK, amount: 90, type: 'withdraw' }),
      txn({ from: null, to: OTHER, amount: 5, type: 'deposit' }),
    ]
    const all = userBalances(txns)
    for (const who of [ME, OTHER, BANK]) {
      const own = txns.filter((t) => t.from_id === who || t.to_id === who)
      expect(all.get(who)).toBe(calculateUserBalance(own, who))
    }
  })
})

describe('L18 a sign-up claims the grants sent to its email', () => {
  // An in-memory stand-in for the Supabase query builder: eq is exact, ilike ignores case and, like Postgres,
  // reads _ and % as wildcards.
  const ilikeMatches = (value: string, pattern: string) => {
    const re = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.').replace(/%/g, '.*')
    return new RegExp(`^${re}$`, 'i').test(value)
  }
  const fakeClient = (rows: Record<string, unknown>[]) => {
    const query = (list: Record<string, unknown>[]): any => ({
      select: () => query(list),
      eq: (col: string, v: unknown) => query(list.filter((r) => r[col] === v)),
      ilike: (col: string, v: string) => query(list.filter((r) => ilikeMatches(String(r[col]), v))),
      then: (resolve: (r: unknown) => unknown) => resolve({ data: list, error: null }),
    })
    return { from: () => query(rows) } as any
  }
  test('a transfer is found by the email it was sent to', async () => {
    const found = await getTransfersByEmail(fakeClient([{ recipient_email: 'new@example.org' }]), 'new@example.org')
    expect(found).toHaveLength(1)
  })
  // Sign-up emails are stored in lowercase; older transfers keep the email as typed (Vals 2026-10-09: fix).
  test('a transfer sent to an email with capitals is found for the same email in lowercase', async () => {
    const found = await getTransfersByEmail(fakeClient([{ recipient_email: 'New@Example.org' }]), 'new@example.org')
    expect(found).toHaveLength(1)
  })
  test('only the same email matches: _ in an email is not a wildcard, and no email matches nothing', async () => {
    const rows = [{ recipient_email: 'a_b@example.org' }, { recipient_email: 'axb@example.org' }]
    const found = await getTransfersByEmail(fakeClient(rows), 'a_b@example.org')
    expect(found.map((t) => t.recipient_email)).toEqual(['a_b@example.org'])
    expect(await getTransfersByEmail(fakeClient(rows), '')).toHaveLength(0)
  })
})
