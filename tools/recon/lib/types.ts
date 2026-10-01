export type Source =
  | 'mercury_grants'
  | 'mercury_mox'
  | 'mercury_other'
  | 'stripe_manifund'
  | 'stripe_mox'
  | 'coinbase'
  | 'other'

// Accounts whose balances appear on the hand-maintained balance sheet
// ('other' = manually-added movements that should still count toward NAV)
export const COUNTED_SOURCES: Source[] = [
  'mercury_grants',
  'mercury_mox',
  'stripe_manifund',
  'stripe_mox',
  'coinbase',
  'other',
]

export const SOURCE_LABELS: Record<Source, string> = {
  mercury_grants: 'Mercury Grants',
  mercury_mox: 'Mercury Mox',
  mercury_other: 'Mercury (off-sheet)',
  stripe_manifund: 'Stripe Manifund',
  stripe_mox: 'Stripe Mox',
  coinbase: 'Coinbase',
  other: 'Other',
}

export type BankTxn = {
  id: string
  source: Source
  dedupeKey: string
  externalId?: string
  date: string // ISO yyyy-mm-dd
  amount: number // positive = inflow to the account
  fee: number
  description: string
  counterparty?: string
  status: string
  raw: Record<string, string>
  category?: string
  categorySource?: 'auto' | 'manual'
  matchId?: string
}

export type MatchKind =
  | 'auto'
  | 'manual'
  | 'internal_transfer'
  | 'no_counterpart'
  | 'offplatform_payment'

export type Match = {
  id: string
  kind: MatchKind
  category?: string
  note?: string
  bankTxnIds: string[]
  platformTxnIds: string[]
  // portion of the bank inflow not credited to any platform balance, kept as Manifund revenue
  revenueRemainder?: number
  // portion of the bank inflow received for a platform account that does not exist yet (pending liability)
  uncreditedRemainder?: number
  createdAt: string
}

export type PlatformTxn = {
  id: string
  created_at: string
  amount: number
  type: 'deposit' | 'withdraw'
  from_id: string | null
  to_id: string
  // resolved counterparty (the non-bank side)
  profileId: string
  username: string
  fullName: string
  email: string
}

export type Snapshot = {
  month: string // yyyy-mm
  balances: Record<string, number>
  computed: Record<string, unknown>
  note?: string
  savedAt: string
}

export const NO_COUNTERPART_CATEGORIES = [
  'pass_through_grant',
  'direct_grant',
  'investor_pass_through',
  'ops',
  'loan_repayment',
  'other',
]

// regrantor_pot: balance credited out of the regrantor pot liability, not new money (liability swap)
export const OFFPLATFORM_CATEGORIES = ['paypal', 'usdc', 'regrantor_pot', 'other']

// revenue sub-buckets; each rolls up into total revenue on the overview
export const REVENUE_CATEGORIES = [
  'revenue_fiscal_sponsorship',
  'revenue_coinbase_yield',
  'revenue_private_offices',
  'revenue_fellowships',
  'revenue_mox_donations',
  'revenue_stripe',
  'revenue_other',
]

export const REVENUE_LABELS: Record<string, string> = {
  revenue_fiscal_sponsorship: 'Fiscal sponsorship fees',
  revenue_coinbase_yield: 'Coinbase yield',
  revenue_private_offices: 'Private offices',
  revenue_fellowships: 'Fellowships',
  revenue_mox_donations: 'Mox donations',
  revenue_stripe: 'Stripe payments',
  revenue_other: 'Other revenue',
  revenue: 'Other revenue', // legacy rows tagged before the split
}

export const isRevenue = (cat?: string | null): boolean =>
  cat === 'revenue' || REVENUE_CATEGORIES.includes(cat ?? '')

export const BANK_CATEGORIES = [
  'internal_transfer',
  'stripe_payout',
  'loan_repayment',
  'payroll',
  'rent',
  'cleaning',
  'card_autopay',
  'wire_fee',
  'direct_grant',
  'ops',
  'other_expenses',
  ...REVENUE_CATEGORIES,
  'other',
]

// Categories that should never be matched against platform txns
export const NEVER_PLATFORM_MATCH = new Set([
  'internal_transfer',
  'stripe_payout',
  'loan_repayment',
  'payroll',
  'rent',
  'card_autopay',
  'wire_fee',
  'direct_grant',
  'revenue',
  ...REVENUE_CATEGORIES,
  'cleaning',
  'other_expenses',
])

// tight tolerance for AUTO-matching (avoid coincidence matches like 600.95 vs 601)
export const AMOUNT_TOLERANCE = 0.05
// looser tolerance for MANUAL match validation (no force needed within $1)
export const MATCH_TOLERANCE = 1
