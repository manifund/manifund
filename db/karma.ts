import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/db/database.types'
import { computeKarma, KARMA_CONFIG, KarmaConfig, KarmaInputs } from '@/utils/karma'

// No next/* or server-only imports here: scripts/*.ts import this file.

// Supabase intermittently times out on bulk reads; one retry is usually enough.
async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i >= attempts) throw e
      await new Promise((r) => setTimeout(r, 1000 * i))
    }
  }
}

// PostgREST caps responses at max_rows; every karma input table is bigger than that.
async function pageAll<T>(query: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await withRetry<{ data: T[] | null }>(() =>
      query(offset, offset + PAGE - 1).throwOnError()
    )
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

export async function loadKarmaInputs(supabase: SupabaseClient): Promise<KarmaInputs> {
  const [profiles, projects, votes, comments, commentRxns, bids, txns] = await Promise.all([
    pageAll<KarmaInputs['profiles'][number]>((f, t) =>
      supabase.from('profiles').select('id, username, full_name').order('id').range(f, t)
    ),
    pageAll<KarmaInputs['projects'][number]>((f, t) =>
      supabase
        .from('projects')
        .select('id, creator, created_at, stage, type, funding_goal, title, slug')
        .order('id')
        .range(f, t)
    ),
    pageAll<KarmaInputs['votes'][number]>((f, t) =>
      supabase
        .from('project_votes')
        .select('voter_id, project_id, magnitude')
        .order('id')
        .range(f, t)
    ),
    pageAll<KarmaInputs['comments'][number]>((f, t) =>
      supabase.from('comments').select('id, commenter, project').order('id').range(f, t)
    ),
    pageAll<KarmaInputs['commentRxns'][number]>((f, t) =>
      supabase
        .from('comment_rxns')
        .select('comment_id, reactor_id, reaction, txn_id')
        .order('comment_id')
        .order('reactor_id')
        .order('reaction')
        .range(f, t)
    ),
    pageAll<KarmaInputs['bids'][number]>((f, t) =>
      supabase
        .from('bids')
        .select('bidder, project, amount, type, status')
        .in('status', ['pending', 'accepted'])
        .order('id')
        .range(f, t)
    ),
    pageAll<KarmaInputs['txns'][number]>((f, t) =>
      supabase
        .from('txns')
        .select('from_id, to_id, amount, type, token, project')
        .eq('token', 'USD')
        .order('id')
        .range(f, t)
    ),
  ])
  return {
    profiles,
    projects,
    votes,
    comments,
    commentRxns,
    bids,
    txns,
    bankId: process.env.NEXT_PUBLIC_PROD_BANK_ID,
  }
}

// Recompute everything and store it. Writes every row (not just changed ones): the stored
// breakdown drives the hot sort (acceptingDonations), and 8.5k row updates take seconds.
export async function recomputeKarma(
  admin: SupabaseClient<Database>,
  config: KarmaConfig = KARMA_CONFIG
) {
  const inputs = await loadKarmaInputs(admin)
  const result = computeKarma(inputs, config)
  const round = (n: number) => Math.round(n * 100) / 100
  const profileRows = [...result.profiles.entries()].map(([id, r]) => ({
    id,
    karma: round(r.karma),
    breakdown: r.breakdown,
  }))
  const projectRows = [...result.projects.entries()].map(([id, r]) => ({
    id,
    karma: round(r.karma),
    breakdown: r.breakdown,
  }))
  const CHUNK = 500
  for (let i = 0; i < profileRows.length; i += CHUNK) {
    await withRetry(() =>
      admin
        .rpc('apply_karma', { profile_rows: profileRows.slice(i, i + CHUNK), project_rows: [] })
        .throwOnError()
    )
  }
  for (let i = 0; i < projectRows.length; i += CHUNK) {
    await withRetry(() =>
      admin
        .rpc('apply_karma', { profile_rows: [], project_rows: projectRows.slice(i, i + CHUNK) })
        .throwOnError()
    )
  }
  return {
    iterations: result.iterations,
    converged: result.converged,
    profilesWritten: profileRows.length,
    projectsWritten: projectRows.length,
  }
}
