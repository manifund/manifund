import { SupabaseClient } from '@supabase/supabase-js'
import type { NetworkActivity, NetworkKind } from '@/lib/follows/network'
import { log } from '@/lib/log'

// Reads with the signed-in person's client: RLS returns only their own follows and saved searches (F2).
// profile_follows and saved_searches aren't in the generated types yet.

// Whether the viewer follows this person (F1).
export async function isFollowing(supabase: SupabaseClient, me: string, followedId: string) {
  const { data } = await (supabase as any)
    .from('profile_follows')
    .select('followed_id')
    .eq('follower_id', me)
    .eq('followed_id', followedId)
    .maybeSingle()
  return !!data
}

export async function listMyFollows(supabase: SupabaseClient, me: string) {
  const { data } = await (supabase as any)
    .from('profile_follows')
    .select(
      'followed_id, created_at, followed:profiles!profile_follows_followed_id_fkey(id, username, full_name, avatar_url)'
    )
    .eq('follower_id', me)
    .order('created_at', { ascending: false })
  return (data ?? []) as {
    followed_id: string
    followed: { id: string; username: string; full_name: string | null; avatar_url: string | null }
  }[]
}

export async function listMySavedSearches(supabase: SupabaseClient, me: string) {
  const { data } = await (supabase as any)
    .from('saved_searches')
    .select('id, name, query, paused_at, created_at')
    .eq('owner_id', me)
    .order('created_at', { ascending: false })
  return (data ?? []) as { id: string; name: string; query: string; paused_at: string | null }[]
}

export async function listMyFollowedProjects(supabase: SupabaseClient, me: string) {
  const { data } = await supabase
    .from('project_follows')
    .select('project_id, projects(title, slug)')
    .eq('follower_id', me)
  return ((data ?? []) as any[]).filter((r) => r.projects) as {
    project_id: string
    projects: { title: string; slug: string }
  }[]
}

// The people the viewer follows (F2: read with their own client). Everything they do is in the viewer's network
// (F8, F10-F12).
export async function myFollowedIds(supabase: SupabaseClient, me: string) {
  const { data } = await (supabase as any)
    .from('profile_follows')
    .select('followed_id')
    .eq('follower_id', me)
  return ((data ?? []) as { followed_id: string }[]).map((r) => r.followed_id)
}

// For a page: by project, what people you follow did there, as a plain object a client component can take;
// undefined when they follow nobody, so home stays exactly as for everyone else (F10).
export async function networkFor(
  supabase: SupabaseClient,
  me: string
): Promise<NetworkActivity | undefined> {
  if (!(await myFollowedIds(supabase, me)).length) return undefined
  // network_activity() reads the signed-in person's follows (auth.uid()), so `supabase` must be theirs (F2)
  const { data, error } = await supabase.rpc('network_activity' as any)
  if (error) log.error('follows.network_activity_failed', { error })
  const out: NetworkActivity = {}
  for (const r of (data ?? []) as { project_id: string; name: string; kind: NetworkKind }[])
    (out[r.project_id] ??= []).push({ name: r.name, kind: r.kind })
  return out
}
