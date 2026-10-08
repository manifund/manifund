import { SupabaseClient } from '@supabase/supabase-js'
import { FullProject, listProjects } from './project'
import { projectHotScore, ProjectKarmaBreakdown } from '@/utils/karma'

// Top projects by stored karma, decayed by age (see utils/karma.ts). Karma is
// recomputed hourly by app/api/karma/sync, so this only needs a tiny projection.
export async function getHotProjects(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<FullProject[]> {
  const { data } = await supabase
    .from('projects')
    .select('id, created_at, karma, karma_breakdown')
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .order('karma', { ascending: false })
    .throwOnError()
  if (!data || data.length === 0) {
    return []
  }
  const now = Date.now()
  const scored = data.map((p) => {
    const breakdown = p.karma_breakdown as ProjectKarmaBreakdown | null
    return {
      id: p.id,
      createdAt: new Date(p.created_at).getTime(),
      hot: projectHotScore(p.karma, p.created_at, breakdown?.acceptingDonations ?? true, now),
    }
  })
  scored.sort((a, b) => b.hot - a.hot || b.createdAt - a.createdAt)
  const topProjectIds = scored.slice(0, limit).map((p) => p.id)
  return await listProjects(supabase, topProjectIds)
}
