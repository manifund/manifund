// Pure (no server-only imports), so unit tests and the home page can import it.
// A saved search is home's search text and categories, as the URL keeps them (`q`, one `cause` per category, F5).
// A new project matches when it has one of the categories (any, when none is picked) and the search text is in its
// title, subtitle or creator's name, as home would show it (F6).
import { searchInAny } from '@/utils/parse'

export type SavedSearch = { q: string; causes: string[] }

export type MatchableProject = {
  title: string
  blurb: string | null
  causes?: { slug: string }[] | null
  creatorName?: string | null
  creatorUsername?: string | null
}

// URL query -> search. Other parameters (the tab, or the filters of saved searches from before 2026-10-13) are
// ignored, so such a search matches more widely rather than not at all.
export function parseSearch(query: string | URLSearchParams): SavedSearch {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query
  const causes = params
    .getAll('cause')
    .map((c) => c.trim())
    .filter(Boolean)
  return { q: (params.get('q') ?? '').trim(), causes: Array.from(new Set(causes)).sort() }
}

// Search -> URL query, the same for the same search whatever order the categories were picked in, so the bell can
// tell a search is already saved. Empty when nothing is searched.
export function searchQuery(s: SavedSearch): string {
  const params = new URLSearchParams()
  if (s.q.trim()) params.set('q', s.q.trim())
  for (const c of Array.from(new Set(s.causes)).sort()) params.append('cause', c)
  return params.toString()
}

export function searchMatches(query: string, p: MatchableProject) {
  const s = parseSearch(query)
  if (s.causes.length && !(p.causes ?? []).some((c) => s.causes.includes(c.slug))) return false
  if (
    s.q &&
    !searchInAny(s.q, p.title, p.blurb ?? '', p.creatorName ?? '', p.creatorUsername ?? '')
  )
    return false
  return true
}

// A short name for a saved search: '"forecasting" in Technical AI safety or Animal welfare'. Category titles when
// the caller knows them, slugs otherwise.
export function searchName(query: string, causeTitles: Record<string, string> = {}) {
  const s = parseSearch(query)
  const causes = s.causes.map((c) => causeTitles[c] ?? c).join(' or ')
  if (s.q && causes) return `"${s.q}" in ${causes}`
  return s.q ? `"${s.q}"` : causes || 'All projects'
}
