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
export type GivingBandKey = (typeof GIVING_BANDS)[number]['key']

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
export type CapacityKey = (typeof CAPACITIES)[number]['key']

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
// picks every charity themself.
export const FUNDS_VS_DIRECT_STOPS = [0, 25, 50, 75, 100] as const
export const FUNDS_LABELS: Record<number, string> = {
  0: 'Everything through funds',
  25: 'Mostly funds',
  50: 'An even split',
  75: 'Mostly my own picks',
  100: 'I pick every charity myself',
}

export type CauseAllocation = { name: string; pct: number }[]

// Starting split shown before the donor touches the sliders. Order here is the
// order on screen and the order colors are assigned in.
export const DEFAULT_CAUSE_ALLOCATION: CauseAllocation = [
  { name: 'AI safety', pct: 30 },
  { name: 'Global health & development', pct: 20 },
  { name: 'Animal welfare', pct: 15 },
  { name: 'Biosecurity', pct: 10 },
  { name: 'EA meta', pct: 5 },
  { name: 'Progress', pct: 5 },
  { name: 'Democracy', pct: 5 },
  { name: 'Political candidates', pct: 5 },
  { name: 'Digital minds', pct: 5 },
]

// One hue per cause position at fixed lightness and chroma, cycling past the
// defaults for causes the donor adds.
export const CAUSE_HUES = [45, 75, 110, 150, 190, 230, 265, 300, 340, 20, 130, 60] as const

export function causeColor(index: number) {
  return `oklch(68% 0.14 ${CAUSE_HUES[index % CAUSE_HUES.length]})`
}

export function labelFor<T extends readonly { key: string; label: string }[]>(
  options: T,
  key: string | null | undefined
) {
  return options.find((o) => o.key === key)?.label ?? null
}

// Sliders move independently; each cause's share is its value over the total.
// Rounding drift lands on the largest cause so the shares always sum to 100.
export function normalizeAllocation(values: { name: string; value: number }[]): CauseAllocation {
  const total = values.reduce((s, c) => s + Math.max(0, c.value), 0)
  if (total <= 0) return values.map((c) => ({ name: c.name, pct: 0 }))
  const out = values.map((c) => ({
    name: c.name,
    pct: Math.round((Math.max(0, c.value) / total) * 100),
  }))
  const drift = 100 - out.reduce((s, c) => s + c.pct, 0)
  if (drift !== 0) {
    const largest = out.reduce((a, c, i) => (c.pct > out[a].pct ? i : a), 0)
    out[largest] = { ...out[largest], pct: out[largest].pct + drift }
  }
  return out
}

export function parseCauseAllocation(value: unknown): CauseAllocation {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (c): c is { name: string; pct: number } =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as any).name === 'string' &&
        typeof (c as any).pct === 'number'
    )
    .map((c) => ({ name: c.name.slice(0, 80), pct: Math.max(0, Math.min(100, Math.round(c.pct))) }))
}

// Email-only respondents have no session, so the edit token doubles as their
// ticket to /donor-survey/results. Scoped to /donor-survey so it is never sent
// with the rest of the site's requests.
export const EDIT_COOKIE = 'donor_survey_edit'
