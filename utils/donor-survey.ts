// Shared vocabulary for the donor survey: option keys, their labels, and the
// shape of a response as the form and the display pages see it. Kept free of
// server imports so the client form can use it too.

export const GIVING_BANDS = [
  { key: 'under_50k', label: '<$50k', min: 0, max: 50_000 },
  { key: '50k_200k', label: '$50k-$200k', min: 50_000, max: 200_000 },
  { key: '200k_500k', label: '$200k-$500k', min: 200_000, max: 500_000 },
  { key: '500k_2m', label: '$500k-$2m', min: 500_000, max: 2_000_000 },
  { key: '2m_5m', label: '$2m-$5m', min: 2_000_000, max: 5_000_000 },
  { key: '5m_plus', label: '$5m+', min: 5_000_000, max: 5_000_000 },
] as const
export type GivingBandKey = (typeof GIVING_BANDS)[number]['key']

export const NOT_SURE_KEY = 'not_sure'
export const GIVING_BANDS_2027 = [
  ...GIVING_BANDS,
  { key: NOT_SURE_KEY, label: 'Not sure yet', min: 0, max: 0 },
] as const

export const CAPACITIES = [
  { key: 'own_money', label: 'my own money' },
  { key: 'grantmaker', label: 'i’m a grantmaker' },
  { key: 'regrantor', label: 'i’m a regrantor or evaluator' },
] as const
export type CapacityKey = (typeof CAPACITIES)[number]['key']

export const HOURS_BANDS = [
  { key: 'lt_1', label: '<1' },
  { key: '1_3', label: '1-3' },
  { key: '3_10', label: '3-10' },
  { key: '10_30', label: '10-30' },
  { key: '30_plus', label: '30+' },
] as const

export const FREQUENCIES = [
  { key: 'weekly', label: 'weekly' },
  { key: 'monthly', label: 'monthly' },
  { key: 'quarterly', label: 'quarterly' },
] as const

export const FUNDS_VS_DIRECT_STOPS = [0, 25, 50, 75, 100] as const

export type CauseAllocation = { name: string; pct: number }[]

// Starting split shown before the donor touches the sliders. Order here is the
// order on screen and the order colors are assigned in.
export const DEFAULT_CAUSE_ALLOCATION: CauseAllocation = [
  { name: 'AI safety', pct: 40 },
  { name: 'GHD', pct: 15 },
  { name: 'Animal welfare', pct: 10 },
  { name: 'Biosecurity', pct: 10 },
  { name: 'EA meta', pct: 5 },
  { name: 'Progress', pct: 5 },
  { name: 'Digital minds', pct: 5 },
  { name: 'Democracy', pct: 5 },
  { name: 'Political candidates', pct: 5 },
]

// Validated for adjacent-pair colorblind separation on a light surface
// (dataviz skill validator). Colors follow the cause's position, so a custom
// cause beyond the ninth gets the stone fallback.
export const CAUSE_COLORS = [
  '#ea580c',
  '#2563eb',
  '#059669',
  '#c026d3',
  '#ca8a04',
  '#0d9488',
  '#e11d48',
  '#4f46e5',
  '#65a30d',
] as const
export const CAUSE_COLOR_FALLBACK = '#57534e'

export function causeColor(index: number) {
  return CAUSE_COLORS[index] ?? CAUSE_COLOR_FALLBACK
}

export function labelFor<T extends readonly { key: string; label: string }[]>(
  options: T,
  key: string | null | undefined
) {
  return options.find((o) => o.key === key)?.label ?? null
}

// Move one slider and rebalance the rest so the total stays at 100. The others
// keep their relative proportions; if they are all zero the remainder is split
// evenly. Integer rounding drift lands on the largest other cause.
export function rebalanceAllocation(
  allocation: CauseAllocation,
  index: number,
  value: number
): CauseAllocation {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const others = allocation.map((c, i) => (i === index ? 0 : c.pct))
  const othersTotal = others.reduce((a, b) => a + b, 0)
  const remainder = 100 - clamped
  const next = allocation.map((c, i) => {
    if (i === index) return { ...c, pct: clamped }
    const share =
      othersTotal > 0
        ? (c.pct / othersTotal) * remainder
        : allocation.length > 1
          ? remainder / (allocation.length - 1)
          : 0
    return { ...c, pct: Math.round(share) }
  })
  const drift = 100 - next.reduce((a, c) => a + c.pct, 0)
  if (drift !== 0) {
    let target = -1
    for (let i = 0; i < next.length; i++) {
      if (i === index) continue
      if (target === -1 || next[i].pct > next[target].pct) target = i
    }
    if (target === -1) target = index
    next[target] = { ...next[target], pct: next[target].pct + drift }
  }
  return next
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

export const CUSTOM_CAUSE_PLACEHOLDER = 'insert your own'

// Email-only respondents have no session, so the edit token doubles as their
// ticket to /donor-survey/results. Scoped to /donor-survey so it is never sent
// with the rest of the site's requests.
export const EDIT_COOKIE = 'donor_survey_edit'
