import { BankTxn } from './types'

// inflowTo: only apply to inflows into that account, and ahead of the generic rules
// (e.g. a fellowship org paying Mox from its own Mercury account looks like an internal transfer)
type Rule = { pattern: RegExp; category: string; inflowTo?: string }

// Generic structural rules only — payee-specific rules live in the local
// gitignored config (data/config.json) and are injected via setPayeeRules.
const GENERIC_RULES: Rule[] = [
  // transfers between our own Mercury accounts (descriptions carry the account name)
  { pattern: /\(Mercury Checking xx\d{4}\)/i, category: 'internal_transfer' },
  { pattern: /^Manifest$/i, category: 'internal_transfer' },
  // Stripe payouts landing in Mercury — pair with the payout leg from the Stripe balance-history export
  { pattern: /^STRIPE$|^Stripe$/, category: 'internal_transfer' },
  { pattern: /Intl\. Wire Fee|International Wire/i, category: 'wire_fee' },
  { pattern: /Mercury Technologies/i, category: 'wire_fee' },
  { pattern: /Mercury Credit/i, category: 'card_autopay' },
  { pattern: /Coinbase yield/i, category: 'revenue_coinbase_yield' },
]

let payeeRules: Rule[] = []

export function setPayeeRules(rules: Rule[]) {
  payeeRules = rules
}

export function autoCategory(
  txn: Pick<BankTxn, 'description' | 'counterparty' | 'source' | 'amount'>
): string | undefined {
  const text = `${txn.description} ${txn.counterparty ?? ''}`
  for (const rule of payeeRules) {
    if (rule.inflowTo && rule.inflowTo === txn.source && txn.amount > 0 && rule.pattern.test(text))
      return rule.category
  }
  for (const rule of [...GENERIC_RULES, ...payeeRules.filter((r) => !r.inflowTo)]) {
    if (rule.pattern.test(txn.description) || rule.pattern.test(text)) return rule.category
  }
  // Mox inflows that aren't transfers/payouts are membership & event revenue
  if (txn.amount > 0 && txn.source === 'stripe_mox') return 'revenue_stripe'
  if (txn.amount > 0 && txn.source === 'mercury_mox') return 'revenue_private_offices'
  // remaining Mox outflows are miscellaneous operating spend
  if (txn.amount < 0 && txn.source === 'mercury_mox') return 'other_expenses'
  return undefined
}
