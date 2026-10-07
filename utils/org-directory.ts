// The org directory's lists, filters and sorting. Pure, so the page and its tests share them.

export const ORG_CAUSES = ['AI safety', 'Biosecurity & health', 'Philanthropy'] as const
export const ORG_FOCUSES = [
  'Evals',
  'Research',
  'Field-building',
  'Infrastructure',
  'Policy & advocacy',
  'Grantmaking',
  'Global health',
] as const

// orgs.legal_structure, as people say it: short for tags and filters, long for the facts card.
export const LEGAL_STRUCTURES: Record<string, { short: string; long: string }> = {
  '501c3': { short: '501(c)(3)', long: '501(c)(3) public charity' },
  '501c4': { short: '501(c)(4)', long: '501(c)(4) social welfare organization' },
  c_corp: { short: 'C corp', long: 'C corporation' },
  pbc: { short: 'PBC', long: 'Public benefit corporation' },
  llc: { short: 'LLC', long: 'Limited liability company' },
  non_us: { short: 'Non-US', long: 'Registered outside the US' },
  fiscally_sponsored: { short: 'Fiscally sponsored', long: 'Fiscally sponsored project' },
  other: { short: 'Other', long: 'Other' },
}

// How many years the card's funding sparkline covers, ending with the current one.
export const SPARK_YEARS = 5

// One org as the directory shows it: its row, plus what Trace and the reviews add.
export type DirectoryOrg = {
  slug: string
  name: string
  logo_url: string | null
  trace_slug: string | null
  summary: string | null
  cause: string | null
  focus: string[]
  legalStructure: string | null
  city: string | null
  // All-time funding Trace has for the org; null when it has none.
  funding: number | null
  // Funding in each of the last SPARK_YEARS years, oldest first.
  fundingByYear: number[]
  staff: number | null
  reviews: number
}

export const ALL_CAUSES = 'All'
export const ORG_SORTS = ['Most funded', 'Most reviewed', 'Largest team', 'A–Z'] as const
export type OrgSort = (typeof ORG_SORTS)[number]

export type OrgFilters = {
  q: string
  cause: string // ALL_CAUSES or a cause
  focus: string[] // any of
  types: string[] // legal structures, any of
}
export const NO_FILTERS: OrgFilters = { q: '', cause: ALL_CAUSES, focus: [], types: [] }

export const anyFilter = (f: OrgFilters) =>
  !!(f.q.trim() || f.cause !== ALL_CAUSES || f.focus.length || f.types.length)

// Everything but the cause: the cause list counts within these, so each count says what picking it
// would show.
function matchesBesidesCause(org: DirectoryOrg, f: OrgFilters) {
  const q = f.q.trim().toLowerCase()
  if (q) {
    const text = [org.name, org.summary, org.cause, ...org.focus].join(' ').toLowerCase()
    if (!text.includes(q)) return false
  }
  if (f.focus.length && !f.focus.some((focus) => org.focus.includes(focus))) return false
  if (f.types.length && !(org.legalStructure && f.types.includes(org.legalStructure))) return false
  return true
}

export function causeCounts(orgs: DirectoryOrg[], f: OrgFilters, causes: string[]) {
  const base = orgs.filter((org) => matchesBesidesCause(org, f))
  return Object.fromEntries([
    [ALL_CAUSES, base.length],
    ...causes.map((cause) => [cause, base.filter((org) => org.cause === cause).length]),
  ]) as Record<string, number>
}

const SORTERS: Record<OrgSort, (a: DirectoryOrg, b: DirectoryOrg) => number> = {
  'Most funded': (a, b) => (b.funding ?? 0) - (a.funding ?? 0),
  'Most reviewed': (a, b) => b.reviews - a.reviews,
  'Largest team': (a, b) => (b.staff ?? 0) - (a.staff ?? 0),
  'A–Z': (a, b) => a.name.localeCompare(b.name),
}

// Groups combine with "and"; within focus and within legal type, any match counts. Ties keep
// alphabetical order.
export function filterOrgs(orgs: DirectoryOrg[], f: OrgFilters, sort: OrgSort) {
  return orgs
    .filter(
      (org) => matchesBesidesCause(org, f) && (f.cause === ALL_CAUSES || org.cause === f.cause)
    )
    .sort((a, b) => SORTERS[sort](a, b) || a.name.localeCompare(b.name))
}
