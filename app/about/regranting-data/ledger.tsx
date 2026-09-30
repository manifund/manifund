'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { Avatar } from '@/components/avatar'

type Grant = {
  id: string
  date: string
  amount: number
  regrantorId: string
  regrantorName: string
  regrantorUsername: string
  regrantorAvatar: string | null
  projectId: string
  projectTitle: string
  projectSlug: string
  projectBlurb: string | null
  projectTotal: number
  comment: string | null
}

type RegrantorRow = {
  id: string
  name: string
  username: string
  avatar: string | null
  bio: string | null
  budget2023: number
  budget2024: number
  budget2025: number
  budget2026: number
}

const YEARS = [2023, 2024, 2025] as const
type YearKey = (typeof YEARS)[number]
type YearSelection = YearKey | 'all'
const YEAR_OPTIONS: YearSelection[] = ['all', ...YEARS]

// Each grantmaking cycle covers a hand-picked set of calendar quarters,
// listed as [year, quarter] pairs. Edit this map to reassign quarters.
const FY_QUARTERS: Record<YearKey, Array<[number, number]>> = {
  2023: [
    [2023, 2],
    [2023, 3],
    [2023, 4],
    [2024, 1],
  ],
  2024: [
    [2024, 2],
    [2024, 3],
    [2024, 4],
    [2025, 1],
  ],
  2025: [
    [2025, 2],
    [2025, 3],
    [2025, 4],
    [2026, 1],
    [2026, 2],
  ],
}

const QUARTERS_RANGE: { year: number; quarter: number }[] = []
for (let y = 2023; y <= 2026; y++) {
  for (let q = 1; q <= 4; q++) QUARTERS_RANGE.push({ year: y, quarter: q })
}

function quarterOf(d: Date) {
  return Math.floor(d.getMonth() / 3) + 1
}

function formatDollarsCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n)}`
}

function formatDollarsFull(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' })
}

function budgetForYear(r: RegrantorRow, year: YearSelection): number {
  if (year === 'all') {
    return r.budget2023 + r.budget2024 + r.budget2025
  }
  return r[`budget${year}` as 'budget2025']
}

function labelForYear(year: YearSelection): string {
  return year === 'all' ? 'all time' : String(year)
}

function isQuarterInFiscalYear(qYear: number, q: number, fy: YearKey): boolean {
  return FY_QUARTERS[fy].some(([y, qq]) => y === qYear && qq === q)
}

function isInFiscalYear(date: Date, fy: YearKey): boolean {
  return isQuarterInFiscalYear(date.getFullYear(), quarterOf(date), fy)
}

function fiscalYearRangeLabel(fy: YearKey): string {
  const quarters = FY_QUARTERS[fy]
  const [firstY, firstQ] = quarters[0]
  const [lastY, lastQ] = quarters[quarters.length - 1]
  return `Q${firstQ} ${firstY} – Q${lastQ} ${lastY}`
}

export function RegrantingLedger({
  grants,
  regrantors,
}: {
  grants: Grant[]
  regrantors: RegrantorRow[]
}) {
  const [year, setYear] = useState<YearSelection>(2025)
  const [activeRegrantor, setActiveRegrantor] = useState<string | null>(null)

  const grantsInYear = useMemo(
    () => (year === 'all' ? grants : grants.filter((g) => isInFiscalYear(new Date(g.date), year))),
    [grants, year]
  )

  const ledgerStats = useMemo(() => {
    const total = grants.reduce((s, g) => s + g.amount, 0)
    const projectIds = new Set(grants.map((g) => g.projectId))
    const regrantorIds = new Set(grants.map((g) => g.regrantorId))
    const sorted = [...grants].map((g) => g.amount).sort((a, b) => a - b)
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
    return {
      total,
      grantsWritten: grants.length,
      projectsBacked: projectIds.size,
      regrantorCount: regrantorIds.size,
      medianGrant: median,
    }
  }, [grants])

  const quarterlyData = useMemo(() => {
    const buckets: Record<string, number> = {}
    for (const g of grants) {
      const d = new Date(g.date)
      const key = `${d.getFullYear()}-Q${quarterOf(d)}`
      buckets[key] = (buckets[key] ?? 0) + g.amount
    }
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowQ = quarterOf(now)
    return QUARTERS_RANGE.filter(
      ({ year: y, quarter: q }) => y < nowYear || (y === nowYear && q <= nowQ)
    ).map(({ year: y, quarter: q }) => {
      const key = `${y}-Q${q}`
      return {
        label: `'${String(y).slice(2)} Q${q}`,
        year: y,
        quarter: q,
        amount: buckets[key] ?? 0,
      }
    })
  }, [grants])

  // Per-regrantor stats for the active year — includes regrantors with either a budget OR grants in this year.
  const regrantorYearRows = useMemo(() => {
    const grantersWithActivity = new Set(grantsInYear.map((g) => g.regrantorId))
    return regrantors
      .filter((r) => budgetForYear(r, year) > 0 || grantersWithActivity.has(r.id))
      .map((r) => {
        const myGrants = grantsInYear.filter((g) => g.regrantorId === r.id)
        const deployed = myGrants.reduce((s, g) => s + g.amount, 0)
        const sortedGrants = [...myGrants].sort((a, b) => b.amount - a.amount)
        return {
          ...r,
          budget: budgetForYear(r, year),
          deployed,
          grantCount: myGrants.length,
          sortedGrants,
        }
      })
      .sort((a, b) => b.deployed - a.deployed || b.budget - a.budget)
  }, [grantsInYear, regrantors, year])

  const topProjectsInYear = useMemo(() => {
    const seen = new Map<string, { project: Grant; backers: Grant[]; regrantedTotal: number }>()
    for (const g of grantsInYear) {
      const entry = seen.get(g.projectId)
      if (entry) {
        entry.backers.push(g)
        entry.regrantedTotal += g.amount
      } else {
        seen.set(g.projectId, { project: g, backers: [g], regrantedTotal: g.amount })
      }
    }
    // Collapse multiple grants from the same regrantor into a single backer entry.
    return Array.from(seen.values())
      .map((entry) => {
        const byRegrantor = new Map<string, Grant>()
        for (const b of entry.backers) {
          const existing = byRegrantor.get(b.regrantorId)
          if (existing) {
            existing.amount += b.amount
            if (!existing.comment && b.comment) existing.comment = b.comment
          } else {
            byRegrantor.set(b.regrantorId, { ...b })
          }
        }
        const uniqueBackers = Array.from(byRegrantor.values()).sort((a, b) => b.amount - a.amount)
        return { ...entry, uniqueBackers }
      })
      .sort((a, b) => b.regrantedTotal - a.regrantedTotal)
      .slice(0, 20)
  }, [grantsInYear])

  const featuredProjects = topProjectsInYear.slice(0, 8)
  const runnerUpProjects = topProjectsInYear.slice(8)

  const feedGrants = useMemo(() => {
    const list = grantsInYear.filter((g) => !activeRegrantor || g.regrantorId === activeRegrantor)
    return list.sort((a, b) => +new Date(b.date) - +new Date(a.date))
  }, [grantsInYear, activeRegrantor])

  const totalDeployedInYear = grantsInYear.reduce((s, g) => s + g.amount, 0)
  const totalBudgetInYear = regrantors.reduce((s, r) => s + budgetForYear(r, year), 0)

  return (
    <div className="mx-auto max-w-4xl p-5">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Where regrantors give</h1>
      </header>

      {/* Top-line stats */}
      <section className="mb-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total deployed" value={formatDollarsCompact(ledgerStats.total)} accent />
          <StatCard label="Grants made" value={ledgerStats.grantsWritten.toString()} />
          <StatCard label="Projects backed" value={ledgerStats.projectsBacked.toString()} />
          <StatCard label="Total regrantors" value={ledgerStats.regrantorCount.toString()} />
        </div>
      </section>

      {/* Quarterly chart */}
      <section className="mb-10">
        <SectionHeading title="Quarterly outlays" subtitle="Dollars deployed per fiscal quarter" />
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={quarterlyData}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                barCategoryGap={4}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatDollarsCompact(v)}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(234,88,12,0.06)' }}
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatDollarsFull(value), 'Deployed']}
                />
                <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                  {quarterlyData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        year === 'all' || isQuarterInFiscalYear(d.year, d.quarter, year)
                          ? '#ea580c'
                          : '#fdba74'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>Bars highlighted: {labelForYear(year)}</span>
            <span>
              {labelForYear(year)} deployed: {formatDollarsCompact(totalDeployedInYear)}
              {totalBudgetInYear > 0 && <> of {formatDollarsCompact(totalBudgetInYear)} budget</>}
            </span>
          </div>
        </div>
      </section>

      {/* Year switcher */}
      <section className="mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Grantmaking cycle
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-orange-600 sm:text-4xl">
                  {labelForYear(year)}
                </span>
                {year !== 'all' && (
                  <span className="text-sm text-gray-500">{fiscalYearRangeLabel(year)}</span>
                )}
              </div>
            </div>
            <div
              role="tablist"
              aria-label="Cycle"
              className="inline-flex rounded-lg bg-gray-100 p-1"
            >
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  role="tab"
                  aria-selected={y === year}
                  onClick={() => {
                    setYear(y)
                    setActiveRegrantor(null)
                  }}
                  className={clsx(
                    'min-w-[64px] rounded-md px-4 py-2 text-base font-semibold transition-all sm:min-w-[72px] sm:text-lg',
                    y === year
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {y === 'all' ? 'All' : y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Regrantor activity */}
      <section className="mb-10">
        <SectionHeading
          title="Regrantor activity"
          subtitle={`Click a regrantor to filter the grant index below`}
        />
        <div className="space-y-3">
          {regrantorYearRows.map((row) => {
            const pct = row.budget > 0 ? Math.min(100, (row.deployed / row.budget) * 100) : 0
            const isActive = activeRegrantor === row.id
            return (
              <div
                key={row.id}
                className={clsx(
                  'overflow-hidden rounded-lg border bg-white shadow-sm transition-colors',
                  isActive ? 'border-orange-400 ring-1 ring-orange-300' : 'border-gray-200'
                )}
              >
                <button
                  onClick={() => setActiveRegrantor((curr) => (curr === row.id ? null : row.id))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 sm:gap-4"
                >
                  <Avatar
                    username={row.username}
                    avatarUrl={row.avatar}
                    id={row.id}
                    noLink
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500">
                      {row.budget > 0 ? (
                        <>
                          {formatDollarsCompact(row.budget)} budget · {row.grantCount} grant
                          {row.grantCount === 1 ? '' : 's'}
                        </>
                      ) : (
                        <>
                          {row.grantCount} grant{row.grantCount === 1 ? '' : 's'} in{' '}
                          {labelForYear(year)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hidden flex-shrink-0 text-right sm:block">
                    <div className="text-sm font-semibold tabular-nums text-orange-600">
                      {formatDollarsCompact(row.deployed)}
                    </div>
                    <div className="text-xs text-gray-500">deployed</div>
                  </div>
                  {row.budget > 0 && (
                    <div className="ml-2 hidden w-32 flex-shrink-0 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${pct}%` }}
                          aria-hidden
                        />
                      </div>
                      <div className="mt-1 text-right text-[11px] text-gray-500">
                        {pct.toFixed(0)}% deployed
                      </div>
                    </div>
                  )}
                </button>

                {row.sortedGrants.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      {isActive
                        ? `All ${row.sortedGrants.length} grant${row.sortedGrants.length === 1 ? '' : 's'} in ${labelForYear(year)}`
                        : `Top grant${row.sortedGrants.length === 1 ? '' : 's'} in ${labelForYear(year)}`}
                    </div>
                    <ol className="space-y-1.5">
                      {(isActive ? row.sortedGrants : row.sortedGrants.slice(0, 3)).map((g) => (
                        <li key={g.id}>
                          <Link
                            href={`/projects/${g.projectSlug}`}
                            className="group flex items-baseline gap-3 text-sm text-gray-800"
                          >
                            <span className="w-14 flex-shrink-0 text-right font-semibold tabular-nums text-orange-600">
                              {formatDollarsCompact(g.amount)}
                            </span>
                            <span className="flex-1 group-hover:underline">{g.projectTitle}</span>
                            <span className="hidden text-xs text-gray-400 sm:inline">
                              {shortDate(g.date)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
          {regrantorYearRows.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
              No regrantor activity in {labelForYear(year)}.
            </div>
          )}
        </div>
      </section>

      {/* Top projects backed */}
      <section className="mb-10">
        <SectionHeading
          title="Largest projects backed"
          subtitle={`Top projects funded ${
            year === 'all' ? 'across all years' : `in ${year}`
          }, ranked by total given via regranting`}
        />
        <ol className="space-y-3">
          {featuredProjects.map((entry, i) => (
            <li
              key={entry.project.projectId}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-medium tabular-nums text-gray-300">#{i + 1}</span>
                    <Link
                      href={`/projects/${entry.project.projectSlug}`}
                      className="text-lg font-semibold text-gray-900 hover:text-orange-600 hover:underline sm:text-xl"
                    >
                      {entry.project.projectTitle}
                    </Link>
                  </div>
                  {entry.project.projectBlurb && (
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                      {entry.project.projectBlurb}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 sm:text-right">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatDollarsCompact(entry.regrantedTotal)}
                  </div>
                  <div className="text-xs text-gray-500">
                    from {entry.uniqueBackers.length} regrantor
                    {entry.uniqueBackers.length === 1 ? '' : 's'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {formatDollarsCompact(entry.project.projectTotal)} raised overall
                  </div>
                </div>
              </div>

              {/* Backers + comments */}
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
                {entry.uniqueBackers.map((b) => (
                  <div key={b.regrantorId} className="flex items-start gap-3">
                    <Avatar
                      username={b.regrantorUsername}
                      avatarUrl={b.regrantorAvatar}
                      id={b.regrantorId}
                      noLink
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link
                          href={`/${b.regrantorUsername}`}
                          className="truncate text-sm font-semibold text-gray-900 hover:underline"
                        >
                          {b.regrantorName}
                        </Link>
                        <span className="text-sm font-semibold tabular-nums text-orange-600">
                          {formatDollarsCompact(b.amount)}
                        </span>
                      </div>
                      {b.comment && (
                        <p className="mt-1 line-clamp-3 text-xs leading-snug text-gray-600">
                          “{b.comment.slice(0, 240)}
                          {b.comment.length > 240 ? '…' : ''}”
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ))}
          {topProjectsInYear.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
              No regrantor-backed projects in {labelForYear(year)} yet.
            </div>
          )}
        </ol>

        {runnerUpProjects.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="hidden grid-cols-12 items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:grid">
              <div className="col-span-1">Rank</div>
              <div className="col-span-6">Project</div>
              <div className="col-span-3">Regrantors</div>
              <div className="col-span-2 text-right">Total regranted</div>
            </div>
            {runnerUpProjects.map((entry, i) => (
              <div
                key={entry.project.projectId}
                className="grid grid-cols-12 items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-gray-50"
              >
                <span className="col-span-1 hidden tabular-nums text-gray-400 sm:inline">
                  #{i + 9}
                </span>
                <Link
                  href={`/projects/${entry.project.projectSlug}`}
                  className="col-span-12 truncate font-medium text-gray-900 hover:text-orange-600 hover:underline sm:col-span-6"
                >
                  <span className="mr-1 tabular-nums text-gray-400 sm:hidden">#{i + 9}</span>
                  {entry.project.projectTitle}
                </Link>
                <div className="col-span-9 -ml-1 flex items-center sm:col-span-3">
                  <div className="isolate flex items-center -space-x-1.5">
                    {entry.uniqueBackers.slice(0, 5).map((b, idx) => (
                      <Avatar
                        key={b.regrantorId}
                        username={b.regrantorUsername}
                        avatarUrl={b.regrantorAvatar}
                        id={b.regrantorId}
                        noLink
                        size="xs"
                        className={clsx(
                          'ring-2 ring-white',
                          ['z-50', 'z-40', 'z-30', 'z-20', 'z-10'][idx]
                        )}
                      />
                    ))}
                  </div>
                  {entry.uniqueBackers.length > 5 && (
                    <span className="ml-2 text-xs text-gray-500">
                      +{entry.uniqueBackers.length - 5}
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-right font-semibold tabular-nums text-orange-600 sm:col-span-2">
                  {formatDollarsCompact(entry.regrantedTotal)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Grant index */}
      <section className="mb-10">
        <SectionHeading
          title="Grant index"
          subtitle={`All ${feedGrants.length} grants${
            activeRegrantor ? ` from ${regrantors.find((r) => r.id === activeRegrantor)?.name}` : ''
          }${year === 'all' ? ' across all years' : ` in ${year}`}, most recent first`}
        />
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-12 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:grid">
            <div className="col-span-2">Date</div>
            <div className="col-span-3">Regrantor</div>
            <div className="col-span-5">Project</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>
          {feedGrants.map((g) => (
            <div
              key={g.id}
              className="grid grid-cols-12 items-center gap-y-1 border-b border-gray-100 px-4 py-3 text-sm last:border-b-0 hover:bg-gray-50"
            >
              <div className="col-span-12 text-xs text-gray-500 sm:col-span-2">
                {shortDate(g.date)}
              </div>
              <Link
                href={`/${g.regrantorUsername}`}
                className="col-span-6 truncate font-semibold text-gray-900 hover:underline sm:col-span-3"
              >
                {g.regrantorName}
              </Link>
              <Link
                href={`/projects/${g.projectSlug}`}
                className="col-span-6 truncate text-gray-700 hover:underline sm:col-span-5"
              >
                {g.projectTitle}
              </Link>
              <div className="col-span-12 text-right font-semibold tabular-nums text-orange-600 sm:col-span-2">
                {formatDollarsCompact(g.amount)}
              </div>
            </div>
          ))}
          {feedGrants.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No grants recorded.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className={clsx(
          'font-bold tabular-nums',
          accent ? 'text-3xl text-orange-600 sm:text-4xl' : 'text-2xl text-gray-900 sm:text-3xl'
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </div>
  )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  )
}
