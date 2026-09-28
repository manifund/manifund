// Shared vocabulary for the donor survey: option keys, their labels, and the
// shape of a response as the form and the display pages see it. Kept free of
// server imports so the client form can use it too.

export const GIVING_BANDS = [
  { key: 'under_50k', label: '<$50k', min: 0, max: 50_000 },
  { key: '50k_200k', label: '$50k–$200k', min: 50_000, max: 200_000 },
  { key: '200k_500k', label: '$200k–$500k', min: 200_000, max: 500_000 },
  { key: '500k_2m', label: '$500k–$2m', min: 500_000, max: 2_000_000 },
  { key: '2m_5m', label: '$2m–$5m', min: 2_000_000, max: 5_000_000 },
  { key: '5m_plus', label: '$5m+', min: 5_000_000, max: 5_000_000 },
] as const

export const NOT_SURE_KEY = 'not_sure'
export const GIVING_BANDS_2027 = [
  ...GIVING_BANDS,
  { key: NOT_SURE_KEY, label: 'Not sure yet', min: 0, max: 0 },
] as const

export const CAPACITIES = [
  { key: 'own_money', label: 'I’m giving my own money' },
  { key: 'regrantor', label: 'I’m a part-time regrantor or evaluator' },
  { key: 'grantmaker', label: 'I’m a fulltime grantmaker' },
] as const

export const HOURS_BANDS = [
  { key: 'lt_1', label: '<1' },
  { key: '1_3', label: '1–3' },
  { key: '3_10', label: '3–10' },
  { key: '10_30', label: '10–30' },
  { key: '30_plus', label: '30+' },
] as const

export const FREQUENCIES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
] as const

// funds_vs_direct: 0 means everything through funds, 100 means the donor
// picks every charity themself. The slider moves in 5% steps.
export const FUNDS_STEP = 5
export const FUNDS_LABELS: Record<number, string> = {
  0: 'Everything through funds',
  25: 'Mostly funds',
  50: 'An even split',
  75: 'Mostly my own picks',
  100: 'I pick every charity myself',
}

export function fundsLabel(value: number) {
  return FUNDS_LABELS[value] ?? `${100 - value}% funds, ${value}% my own picks`
}

// Cause areas, rated 1-5 stars. The first TOP_CAUSE_COUNT show by default;
// the rest, and any the donor adds, sit behind an expander.
export const CAUSES = [
  'AI safety',
  'Global health & development',
  'Animal welfare',
  'Biosecurity',
  'EA meta',
  'Progress',
  'Democracy',
  'Political candidates',
  'Digital minds',
]
export const TOP_CAUSE_COUNT = 5
export const MAX_RATING = 5

export type CauseRatings = { name: string; rating: number }[]

// A blank response, as the form holds it: text fields as '', unanswered
// choices as null. Its keys are the survey's fields.
export const EMPTY_SURVEY = {
  full_name: '',
  email: '',
  capacity: [] as string[],
  org: '',
  giving_2026: '',
  giving_2027: '',
  cause_ratings: [] as CauseRatings,
  advice_sources: '',
  landscape_problems: '',
  funds_vs_direct: null as number | null,
  already_given: '',
  already_given_link: '',
  evaluation_approach: '',
  charities_interested: '',
  hours_per_month: '',
  dream_setup: '',
  wants_opportunities: null as boolean | null,
  opportunity_frequency: '',
  wants_call: false,
  wants_events: false,
  share_with_funders: false,
  is_public: false,
  other_thoughts: '',
  referrals: '',
}
export type DonorSurveyInput = typeof EMPTY_SURVEY

export function labelFor<T extends readonly { key: string; label: string }[]>(
  options: T,
  key: string | null | undefined
) {
  return options.find((o) => o.key === key)?.label ?? null
}

// Keeps well-formed entries only: a name and a whole-number rating from 1 to
// MAX_RATING, one entry per name.
export function parseCauseRatings(value: unknown): CauseRatings {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: CauseRatings = []
  for (const c of value) {
    const name = typeof c?.name === 'string' ? c.name.trim().slice(0, 80) : ''
    const rating = c?.rating
    if (!name || seen.has(name.toLowerCase())) continue
    if (!Number.isInteger(rating) || rating < 1 || rating > MAX_RATING) continue
    seen.add(name.toLowerCase())
    out.push({ name, rating })
  }
  return out
}

// Email-only respondents have no session, so the edit token doubles as their
// ticket to /donor-survey/results. Scoped to /donor-survey so it is never sent
// with the rest of the site's requests.
export const EDIT_COOKIE = 'donor_survey_edit'
