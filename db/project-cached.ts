import { revalidateTag, unstable_cache } from 'next/cache'
import { createPublicSupabaseClient } from './supabase-server'
import { getHotProjects } from './project-hot'
import { FullProject, getFullSimilarProjects } from './project'

let inFlight: Promise<FullProject[]> | null = null

export const getHotProjectsCached = unstable_cache(
  async () => {
    // A failed revalidation leaves the cache empty, so without this every concurrent
    // request starts its own copy of the query and they pile onto each other.
    if (!inFlight) {
      inFlight = getHotProjects(createPublicSupabaseClient(), 20).finally(() => {
        inFlight = null
      })
    }
    return await inFlight
  },
  ['hot-projects'],
  {
    revalidate: 3600, // 1 hr
    tags: ['hot-projects'], // cache key
  }
)

// Similar projects come from a vector search over every project's embedding (~140 ms on
// production, run on every project page view, mostly by crawlers). Embeddings change only
// with the daily sync, so an hour-old answer is fine. Every table it reads is public, so
// the public client returns the same rows as the viewer's own.
export const getFullSimilarProjectsCached = unstable_cache(
  async (projectId: string, count: number) =>
    getFullSimilarProjects(createPublicSupabaseClient(), projectId, count),
  ['similar-projects'],
  { revalidate: 3600, tags: ['similar-projects'] }
)

export function invalidateProjectsCache() {
  // revalidateTag is an App Router-only API: called from a Pages Router API
  // route it throws "Invariant: static generation store missing" and 500s the
  // whole request. Swallow that so Pages Router callers survive; the actual
  // revalidation for create/edit/publish happens in /api/score-project (App
  // Router), and the hot-projects cache otherwise expires within an hour.
  try {
    revalidateTag('hot-projects', 'max')
  } catch (error) {
    console.error('invalidateProjectsCache failed (Pages Router context?):', error)
  }
}
