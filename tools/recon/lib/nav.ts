import { BankTxn, COUNTED_SOURCES, isRevenue, Match, PlatformTxn, Snapshot } from './types'

export type NavReport = {
  window: [string, string]
  netExternalFlows: number
  liabilityDelta: number
  expectedNavChange: number
  breakdown: {
    donationsCredited: number
    uncreditedDeposits: number // received for accounts not yet created; a pending liability, NAV-neutral
    donationsPassThrough: number
    revenue: number // Mox memberships, desk fees, sponsorships
    revenueByKind: Record<string, number> // revenue_* buckets; fiscal sponsorship comes from match remainders
    withdrawalsPaid: number
    directGrants: number
    opsByAccount: Record<string, number>
    fees: number
    offSheetTransfers: number // net flow to/from accounts not on the balance sheet (Surplus, Frame, ...)
    transferResidual: number
  }
  coverage: {
    unmatchedDepositsInWindow: number // platform deposits with no bank match — missing account coverage (e.g. Coinbase)
    unmatchedDepositsSum: number
  }
  timing: {
    inFlightWithdrawals: { txnId: string; who: string; amount: number; date: string }[]
    bankMatchedOutOfWindow: { bankTxnId: string; description: string; amount: number }[]
  }
  priorSnapshot?: Snapshot
}

export function computeNav(
  bankTxns: BankTxn[],
  matches: Match[],
  platformTxns: PlatformTxn[],
  window: [string, string],
  priorSnapshot?: Snapshot
): NavReport {
  const [start, end] = window
  const inWindow = (date: string) => date >= start && date <= end
  const counted = new Set<string>(COUNTED_SOURCES)
  const matchByBankId = new Map<string, Match>()
  const matchByPlatformId = new Map<string, Match>()
  for (const m of matches) {
    for (const b of m.bankTxnIds) matchByBankId.set(b, m)
    for (const p of m.platformTxnIds) matchByPlatformId.set(p, m)
  }
  const bankById = new Map(bankTxns.map((t) => [t.id, t]))

  const rows = bankTxns.filter((t) => counted.has(t.source) && inWindow(t.date))

  let netExternalFlows = 0
  let transferResidual = 0
  let donationsCredited = 0
  let uncreditedDeposits = 0
  let donationsPassThrough = 0
  let withdrawalsPaid = 0
  let directGrants = 0
  let fees = 0
  let offSheetTransfers = 0
  let revenue = 0
  const revenueByKind: Record<string, number> = {}
  const addRevenue = (kind: string, amount: number) => {
    revenue += amount
    revenueByKind[kind] = (revenueByKind[kind] ?? 0) + amount
  }
  const opsByAccount: Record<string, number> = {}

  // an internal transfer nets out only when its counterpart leg is also in a counted account
  const netsOut = (t: BankTxn): boolean => {
    const m = matchByBankId.get(t.id)
    if (!m || m.kind !== 'internal_transfer') return false
    const partnerId = m.bankTxnIds.find((id) => id !== t.id)
    const partner = partnerId ? bankById.get(partnerId) : undefined
    return !!partner && counted.has(partner.source)
  }

  for (const t of rows) {
    const m = matchByBankId.get(t.id)
    const cat = t.category ?? m?.category
    if (cat === 'stripe_payout') continue // counterpart is the (counted) Stripe balance; charges already counted
    if (cat === 'loan_repayment') continue // asset swap: a loan receivable on the sheet turned back into cash
    if (cat === 'internal_transfer') {
      if (netsOut(t)) {
        transferResidual += t.amount // paired counted<->counted legs must sum to ~0
      } else {
        // transfer to/from an off-sheet account (Surplus, Frame, Manifest...) — real flow for the sheet
        netExternalFlows += t.amount
        offSheetTransfers += t.amount
      }
      continue
    }
    netExternalFlows += t.amount
    fees += t.fee
    if (t.amount > 0) {
      if (isRevenue(cat)) addRevenue(cat === 'revenue' ? 'revenue_other' : cat!, t.amount)
      else if (m && m.platformTxnIds.length > 0) donationsCredited += t.amount
      else donationsPassThrough += t.amount
    } else {
      if (cat === 'direct_grant') directGrants += -t.amount
      else if (m && m.platformTxnIds.length > 0) withdrawalsPaid += -t.amount
      else if (cat === 'wire_fee') fees += -t.amount
      else opsByAccount[t.source] = (opsByAccount[t.source] ?? 0) + -t.amount
    }
  }

  // match-level revenue remainders (bank inflow exceeding the platform credit, kept by Manifund)
  for (const m of matches) {
    if (!m.revenueRemainder && !m.uncreditedRemainder) continue
    const inScope = m.bankTxnIds.some((id) => {
      const t = bankById.get(id)
      return t && counted.has(t.source) && inWindow(t.date)
    })
    if (!inScope) continue
    if (m.revenueRemainder) {
      addRevenue('revenue_fiscal_sponsorship', m.revenueRemainder)
      donationsCredited -= m.revenueRemainder
    }
    if (m.uncreditedRemainder) {
      uncreditedDeposits += m.uncreditedRemainder
      donationsCredited -= m.uncreditedRemainder
    }
  }

  // platform liability change in window (deposits raise user balances, withdrawals lower them)
  let liabilityDelta = 0
  for (const p of platformTxns) {
    if (!inWindow(p.created_at.slice(0, 10))) continue
    // credited from the regrantor pot: one liability becomes another, no NAV change
    if (matchByPlatformId.get(p.id)?.category === 'regrantor_pot') continue
    liabilityDelta += p.type === 'deposit' ? p.amount : -p.amount
  }

  // timing: platform withdrawals in the window with no bank match
  const inFlightWithdrawals = platformTxns
    .filter(
      (p) =>
        p.type === 'withdraw' && inWindow(p.created_at.slice(0, 10)) && !matchByPlatformId.has(p.id)
    )
    .map((p) => ({
      txnId: p.id,
      who: `${p.username} (${p.fullName})`,
      amount: p.amount,
      date: p.created_at.slice(0, 10),
    }))
    .sort((a, b) => b.amount - a.amount)

  // bank rows in window whose matched platform txns fall outside the window
  const bankMatchedOutOfWindow = rows
    .filter((t) => {
      const m = matchByBankId.get(t.id)
      if (!m || m.platformTxnIds.length === 0) return false
      return m.platformTxnIds.every((pid) => {
        const p = platformTxns.find((x) => x.id === pid)
        return p && !inWindow(p.created_at.slice(0, 10))
      })
    })
    .map((t) => ({ bankTxnId: t.id, description: t.description, amount: t.amount }))

  const unmatchedDeposits = platformTxns.filter(
    (p) =>
      p.type === 'deposit' && inWindow(p.created_at.slice(0, 10)) && !matchByPlatformId.has(p.id)
  )

  return {
    window,
    netExternalFlows,
    liabilityDelta,
    expectedNavChange: netExternalFlows - liabilityDelta - uncreditedDeposits,
    breakdown: {
      donationsCredited,
      uncreditedDeposits,
      donationsPassThrough,
      revenue,
      revenueByKind,
      withdrawalsPaid,
      directGrants,
      opsByAccount,
      fees,
      offSheetTransfers,
      transferResidual,
    },
    coverage: {
      unmatchedDepositsInWindow: unmatchedDeposits.length,
      unmatchedDepositsSum: unmatchedDeposits.reduce((s, p) => s + p.amount, 0),
    },
    timing: { inFlightWithdrawals, bankMatchedOutOfWindow },
    priorSnapshot,
  }
}
