import type { OrgGrant } from '@/db/org'

// Series colors for the funding chart: the org's biggest funders, then everyone else in gray.
const FUNDER_COLORS = ['#ea580c', '#fb923c', '#fb7185', '#fcd34d']
const OTHER_COLOR = '#d1d5db'
const OTHER_KEY = 'other'
const MAX_YEARS = 10

// Trace's rows for money with no named source ("Unknown Donors": an estimate of what public grants don't
// cover). Real money, so it counts in totals and bars, but it never takes a named funder's place.
const PLACEHOLDER_NAME = /^\(?\s*(unknown|various|undisclosed|anonymous)\b/i
const isPlaceholder = (name: string) => PLACEHOLDER_NAME.test(name.trim())

export type FundingSeries = { key: string; name: string; color: string; total: number }
export type FundingYear = {
  year: number
  label: string
  total: number
  // In series order, only the series with money that year.
  segments: { key: string; amount: number }[]
}
export type FundingSummary = {
  total: number
  grantCount: number
  // Named funders first (largest first), then one gray series for everyone else.
  series: FundingSeries[]
  years: FundingYear[]
}

// "$48.2M", "$650K", "$900"
export function formatCompactMoney(amount: number) {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`
  if (amount >= 1e3) return `$${Math.round(amount / 1e3)}K`
  return `$${Math.round(amount)}`
}

// What the funding section shows, from the grants Trace has for the org: the total is a plain sum of every
// grant with a known amount; the chart covers the last ten years with a grant, by funder.
export function summarizeFunding(grants: OrgGrant[], thisYear: number): FundingSummary {
  const priced = grants.filter((grant) => grant.amountUsd !== null && grant.amountUsd > 0)
  const total = priced.reduce((sum, grant) => sum + (grant.amountUsd ?? 0), 0)

  const byFunder = new Map<string, { name: string; total: number }>()
  for (const grant of priced) {
    const funder = byFunder.get(grant.funderSlug) ?? { name: grant.funderName, total: 0 }
    funder.total += grant.amountUsd ?? 0
    byFunder.set(grant.funderSlug, funder)
  }
  const ranked = [...byFunder.entries()].sort((a, b) => b[1].total - a[1].total)
  const named = ranked
    .filter(([, funder]) => !isPlaceholder(funder.name))
    .slice(0, FUNDER_COLORS.length)
  const namedSlugs = new Set(named.map(([key]) => key))
  const rest = ranked.filter(([key]) => !namedSlugs.has(key))
  const restNamed = rest.filter(([, funder]) => !isPlaceholder(funder.name))
  const series: FundingSeries[] = named.map(([key, funder], i) => ({
    key,
    name: funder.name,
    color: FUNDER_COLORS[i],
    total: funder.total,
  }))
  if (rest.length > 0) {
    series.push({
      key: OTHER_KEY,
      // Only placeholder rows left: say what they are rather than counting them as funders.
      name:
        restNamed.length > 0
          ? `${restNamed.length} other funder${restNamed.length === 1 ? '' : 's'}`
          : 'Undisclosed donors',
      color: OTHER_COLOR,
      total: rest.reduce((sum, [, funder]) => sum + funder.total, 0),
    })
  }
  const namedKeys = new Set(named.map(([key]) => key))

  const dated = priced.filter((grant) => grant.date)
  const grantYears = dated.map((grant) => Number((grant.date as string).slice(0, 4)))
  const years: FundingYear[] = []
  if (grantYears.length > 0) {
    const last = Math.max(...grantYears)
    const first = Math.max(Math.min(...grantYears), last - MAX_YEARS + 1)
    for (let year = first; year <= last; year++) {
      const amounts = new Map<string, number>()
      dated.forEach((grant, i) => {
        if (grantYears[i] !== year) return
        const key = namedKeys.has(grant.funderSlug) ? grant.funderSlug : OTHER_KEY
        amounts.set(key, (amounts.get(key) ?? 0) + (grant.amountUsd ?? 0))
      })
      const segments = series
        .filter((s) => amounts.has(s.key))
        .map((s) => ({ key: s.key, amount: amounts.get(s.key) as number }))
      years.push({
        year,
        label: year === thisYear ? `${year} YTD` : `${year}`,
        total: segments.reduce((sum, segment) => sum + segment.amount, 0),
        segments,
      })
    }
  }
  return { total, grantCount: grants.length, series, years }
}
