'use client'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { SearchBar } from '@/components/input'
import { Select } from '@/components/select'
import { formatCompactMoney } from '@/utils/org-funding'
import {
  ALL_CAUSES,
  LEGAL_STRUCTURES,
  NO_FILTERS,
  ORG_CAUSES,
  ORG_FOCUSES,
  ORG_SORTS,
  anyFilter,
  causeCounts,
  filterOrgs,
  type DirectoryOrg,
  type OrgFilters,
  type OrgSort,
} from '@/utils/org-directory'
import { OrgCard } from './org-card'

const DEFAULT_SORT: OrgSort = 'Most funded'
const ADD_ORG = `mailto:hi@manifund.org?subject=${encodeURIComponent('An org for manifund.org/orgs')}`

// The filters live in the address, so a filtered list can be shared and survives a reload.
function readAddress(): { filters: OrgFilters; sort: OrgSort } {
  const params = new URLSearchParams(window.location.search)
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? []
  const sort = params.get('sort') as OrgSort | null
  return {
    filters: {
      q: params.get('q') ?? '',
      cause: params.get('cause') ?? ALL_CAUSES,
      focus: list('focus'),
      types: list('type'),
    },
    sort: sort && ORG_SORTS.includes(sort) ? sort : DEFAULT_SORT,
  }
}

function writeAddress(filters: OrgFilters, sort: OrgSort) {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.cause !== ALL_CAUSES) params.set('cause', filters.cause)
  if (filters.focus.length) params.set('focus', filters.focus.join(','))
  if (filters.types.length) params.set('type', filters.types.join(','))
  if (sort !== DEFAULT_SORT) params.set('sort', sort)
  const query = params.toString()
  window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
}

export function OrgsDirectory(props: { orgs: DirectoryOrg[] }) {
  const { orgs } = props
  const [filters, setFilters] = useState<OrgFilters>(NO_FILTERS)
  const [sort, setSort] = useState<OrgSort>(DEFAULT_SORT)
  const [moreOpen, setMoreOpen] = useState(false)
  // Read the address once the page is in the browser, then keep it in step.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const fromAddress = readAddress()
    setFilters(fromAddress.filters)
    setSort(fromAddress.sort)
    setReady(true)
  }, [])
  useEffect(() => {
    if (ready) writeAddress(filters, sort)
  }, [ready, filters, sort])

  const set = (patch: Partial<OrgFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const toggle = (key: 'focus' | 'types', value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }))
  const clear = () => setFilters(NO_FILTERS)

  // Only what some org has is offered: a filter that can't match anything is noise.
  const causes = ORG_CAUSES.filter((cause) => orgs.some((org) => org.cause === cause))
  const focuses = ORG_FOCUSES.filter((focus) => orgs.some((org) => org.focus.includes(focus)))
  const types = Object.keys(LEGAL_STRUCTURES)
    .map((type) => ({
      type,
      label: LEGAL_STRUCTURES[type].short,
      count: orgs.filter((org) => org.legalStructure === type).length,
    }))
    .filter((t) => t.count > 0)
  const counts = causeCounts(orgs, filters, causes)
  const causeOptions = [ALL_CAUSES, ...causes]

  const shown = filterOrgs(orgs, filters, sort)
  const total = shown.reduce((sum, org) => sum + (org.funding ?? 0), 0)
  const filtering = anyFilter(filters)

  const focusChips = focuses.map((focus) => {
    const on = filters.focus.includes(focus)
    return (
      <button
        key={focus}
        type="button"
        aria-pressed={on}
        onClick={() => toggle('focus', focus)}
        className={clsx(
          'rounded-full border px-[11px] py-[5px] text-[13px] transition-colors',
          on
            ? 'border-orange-500 bg-orange-50 text-orange-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        )}
      >
        {focus}
      </button>
    )
  })
  const typeChecks = types.map(({ type, label, count }) => {
    const on = filters.types.includes(type)
    return (
      <button
        key={type}
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={() => toggle('types', type)}
        className="flex w-full items-center gap-2.5 py-1.5 text-left text-sm text-gray-700"
      >
        <span
          className={clsx(
            'flex h-4 w-4 flex-none items-center justify-center rounded border text-[11px] leading-none text-white',
            on ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'
          )}
        >
          {on && '✓'}
        </span>
        <span className="flex-1">{label}</span>
        <span className="text-xs tabular-nums text-gray-400">{count}</span>
      </button>
    )
  })
  const sortSelect = (
    <Select options={[...ORG_SORTS]} selected={sort} onSelect={(s) => setSort(s as OrgSort)} />
  )

  return (
    <div className="px-4 pb-24 pt-10 font-light sm:px-6">
      {/* Below xl: causes as tabs with the search, then the other filters in a row. */}
      <div className="mb-7 xl:hidden">
        <nav className="flex flex-wrap items-center gap-1 border-b border-gray-200">
          {causeOptions.map((cause) => {
            const on = filters.cause === cause
            return (
              <button
                key={cause}
                type="button"
                aria-pressed={on}
                onClick={() => set({ cause })}
                className={clsx(
                  '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-[13px] pt-3 transition-colors hover:text-gray-900',
                  on ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500'
                )}
              >
                <span>{cause}</span>
                <span
                  className={clsx(
                    'rounded-full px-2 py-1 text-[13px] font-normal tabular-nums leading-none',
                    on ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-800'
                  )}
                >
                  {counts[cause]}
                </span>
              </button>
            )
          })}
          <div className="flex-1" />
          <SearchBar
            search={filters.q}
            setSearch={(q) => set({ q })}
            placeholder="Search orgs"
            className="min-w-[200px] flex-[0_1_280px] py-1.5"
          />
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex flex-[1_1_400px] flex-wrap gap-1.5">{focusChips}</div>
          <div className="flex items-center gap-2.5">
            {types.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <span>More filters</span>
                  {filters.types.length > 0 && (
                    <span className="rounded-full bg-orange-100 px-[7px] py-[3px] text-xs leading-none text-orange-700">
                      {filters.types.length}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">▼</span>
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[250px] rounded-lg border border-gray-100 bg-white p-4 shadow-md">
                      <RailLabel>Legal type</RailLabel>
                      {typeChecks}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="min-w-[160px]">{sortSelect}</div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-10">
        <main className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="hidden flex-wrap items-center gap-3 xl:flex">
            <SearchBar
              search={filters.q}
              setSearch={(q) => set({ q })}
              placeholder="Search by name, focus or what they do"
              className="min-w-0 flex-[1_1_280px]"
            />
            <div className="min-w-[170px]">{sortSelect}</div>
          </div>
          <div className="text-[13px] text-gray-500">
            {/* {shown.length} org{shown.length === 1 ? '' : 's'} */}
            {/* {total > 0 && <> · {formatCompactMoney(total)} in tracked funding</>} */}
            {/* {' · '} */}
            We're highlighting orgs we respect, but they're not affiliated with Manifund by default.
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
            {shown.map((org) => (
              <OrgCard key={org.slug} org={org} />
            ))}
          </div>
          {shown.length === 0 && (
            <div className="py-12 text-center text-[15px] text-gray-500">
              No orgs match those filters.{' '}
              <button type="button" onClick={clear} className="text-orange-600 hover:underline">
                Clear filters
              </button>
            </div>
          )}
          <div className="mt-4 flex justify-center gap-1.5 text-sm text-gray-500">
            Missing someone?
            <a href={ADD_ORG} className="text-orange-600 hover:underline">
              Suggest an org →
            </a>
          </div>
        </main>

        <aside className="hidden w-60 flex-none flex-col gap-7 xl:flex">
          <div>
            <RailLabel>Cause</RailLabel>
            <div className="flex flex-col gap-0.5">
              {causeOptions.map((cause) => {
                const on = filters.cause === cause
                return (
                  <button
                    key={cause}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ cause })}
                    className={clsx(
                      'flex items-center justify-between gap-2 rounded-md px-2.5 py-[7px] text-left text-sm transition-colors hover:bg-orange-50',
                      on ? 'bg-orange-50 font-normal text-orange-700' : 'text-gray-700'
                    )}
                  >
                    <span>{cause}</span>
                    <span
                      className={clsx(
                        'text-xs tabular-nums',
                        on ? 'text-orange-600' : 'text-gray-400'
                      )}
                    >
                      {counts[cause]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          {focuses.length > 0 && (
            <div>
              <RailLabel>Focus</RailLabel>
              <div className="flex flex-wrap gap-1.5">{focusChips}</div>
            </div>
          )}
          {types.length > 0 && (
            <div>
              <RailLabel>Legal type</RailLabel>
              <div className="flex flex-col gap-0.5">{typeChecks}</div>
            </div>
          )}
          {filtering && (
            <button
              type="button"
              onClick={clear}
              className="text-left text-[13px] text-orange-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}

function RailLabel(props: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-gray-500">
      {props.children}
    </div>
  )
}
