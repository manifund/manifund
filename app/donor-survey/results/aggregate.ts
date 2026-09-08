import {
  CAPACITIES,
  DEFAULT_CAUSE_ALLOCATION,
  FREQUENCIES,
  FUNDS_VS_DIRECT_STOPS,
  GIVING_BANDS,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  causeColor,
  parseCauseAllocation,
  CAUSE_COLOR_FALLBACK,
} from '@/utils/donor-survey'
import type { DonorSurveyResponse } from '@/db/donor-survey'

export type Bar = { key: string; label: string; count: number; color?: string }

type Row = Pick<
  DonorSurveyResponse,
  | 'capacity'
  | 'giving_2026'
  | 'giving_2027'
  | 'cause_allocation'
  | 'funds_vs_direct'
  | 'hours_per_month'
  | 'wants_opportunities'
  | 'opportunity_frequency'
  | 'wants_call'
  | 'wants_events'
  | 'share_with_funders'
  | 'is_public'
>

function countBy(
  rows: Row[],
  options: readonly { key: string; label: string }[],
  pick: (r: Row) => string | null | undefined
): Bar[] {
  return options.map((o) => ({
    key: o.key,
    label: o.label,
    count: rows.filter((r) => pick(r) === o.key).length,
  }))
}

export function aggregate(rows: Row[]) {
  const n = rows.length

  const giving2026 = countBy(rows, GIVING_BANDS, (r) => r.giving_2026)
  const giving2027 = countBy(rows, GIVING_BANDS_2027, (r) => r.giving_2027)

  // Combined 2026 giving, from band bounds. The top band has no ceiling, so
  // the upper figure is open-ended whenever anyone picked it.
  let low = 0
  let high = 0
  let openEnded = false
  for (const r of rows) {
    const band = GIVING_BANDS.find((b) => b.key === r.giving_2026)
    if (!band) continue
    low += band.min
    high += band.max
    if (band.key === '5m_plus') openEnded = true
  }

  // Mean share per cause across everyone who answered. A cause someone did not
  // list counts as 0% for them, so the means still sum to 100.
  const causeTotals = new Map<string, number>()
  let causeRespondents = 0
  for (const r of rows) {
    const alloc = parseCauseAllocation(r.cause_allocation)
    if (alloc.length === 0) continue
    causeRespondents++
    for (const c of alloc) {
      const name = c.name.trim()
      causeTotals.set(name, (causeTotals.get(name) ?? 0) + c.pct)
    }
  }
  const defaultIndex = new Map(DEFAULT_CAUSE_ALLOCATION.map((c, i) => [c.name, i]))
  const causes = [...causeTotals.entries()]
    .map(([name, total]) => ({
      name,
      mean: causeRespondents ? total / causeRespondents : 0,
      color: defaultIndex.has(name) ? causeColor(defaultIndex.get(name)!) : CAUSE_COLOR_FALLBACK,
      custom: !defaultIndex.has(name),
    }))
    .sort((a, b) => b.mean - a.mean)

  const fundsRows = rows.filter((r) => r.funds_vs_direct !== null)
  const fundsVsDirect: Bar[] = FUNDS_VS_DIRECT_STOPS.map((stop) => ({
    key: String(stop),
    label: `${stop}%`,
    count: fundsRows.filter((r) => r.funds_vs_direct === stop).length,
  }))
  const fundsMean = fundsRows.length
    ? fundsRows.reduce((a, r) => a + (r.funds_vs_direct ?? 0), 0) / fundsRows.length
    : null

  const hours = countBy(rows, HOURS_BANDS, (r) => r.hours_per_month)
  const hoursAnswered = rows.filter((r) => r.hours_per_month).length

  const capacity: Bar[] = CAPACITIES.map((o) => ({
    key: o.key,
    label: o.label,
    count: rows.filter((r) => (r.capacity ?? []).includes(o.key)).length,
  }))

  const wantsOpportunities = rows.filter((r) => r.wants_opportunities === true).length
  const frequency = countBy(
    rows.filter((r) => r.wants_opportunities === true),
    FREQUENCIES,
    (r) => r.opportunity_frequency
  )
  const wantsCall = rows.filter((r) => r.wants_call).length
  const wantsEvents = rows.filter((r) => r.wants_events).length
  const shareWithFunders = rows.filter((r) => r.share_with_funders).length
  const isPublic = rows.filter((r) => r.is_public).length

  return {
    n,
    giving2026,
    giving2027,
    combined2026: { low, high, openEnded },
    causes,
    causeRespondents,
    fundsVsDirect,
    fundsAnswered: fundsRows.length,
    fundsMean,
    hours,
    hoursAnswered,
    capacity,
    wantsOpportunities,
    frequency,
    wantsCall,
    wantsEvents,
    shareWithFunders,
    isPublic,
  }
}

export type Aggregate = ReturnType<typeof aggregate>

export function formatCompactDollars(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}m`
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}
