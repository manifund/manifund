import type { SupabaseClient } from '@supabase/supabase-js'

// What a person follows, for the Following tab of their profile (F9). It's all public (F2; Vals, 2026-10-14: "it's
// interesting to be able to see a regranter's search"), so it's read with the visitor's own client.

export type FollowedPerson = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}
export type FollowedProject = { id: string; title: string; slug: string }
export type SavedSearch = { id: string; name: string; query: string }
export type Following = {
  people: FollowedPerson[]
  projects: FollowedProject[]
  searches: SavedSearch[]
}

// Projects nobody else can open stay off a profile (the owner sees the rest of their list either way).
const LISTED_STAGES = ['proposal', 'active', 'complete', 'not funded']

export async function getFollowing(
  supabase: SupabaseClient,
  profileId: string,
  isOwnProfile: boolean
): Promise<Following> {
  const db = supabase as any
  const [people, projects, searches] = await Promise.all([
    db
      .from('profile_follows')
      .select(
        'created_at, followed:profiles!profile_follows_followed_id_fkey(id, username, full_name, avatar_url)'
      )
      .eq('follower_id', profileId)
      .order('created_at', { ascending: false }),
    db
      .from('project_follows')
      .select('project_id, projects(id, title, slug, stage)')
      .eq('follower_id', profileId),
    db
      .from('saved_searches')
      .select('id, name, query')
      .eq('owner_id', profileId)
      .order('created_at', { ascending: false }),
  ])
  return {
    people: ((people.data ?? []) as { followed: FollowedPerson | null }[])
      .map((r) => r.followed)
      .filter((p): p is FollowedPerson => !!p),
    projects: (
      (projects.data ?? []) as { projects: (FollowedProject & { stage: string }) | null }[]
    )
      .map((r) => r.projects)
      .filter((p): p is FollowedProject & { stage: string } => !!p)
      .filter((p) => isOwnProfile || LISTED_STAGES.includes(p.stage))
      .map(({ id, title, slug }) => ({ id, title, slug })),
    searches: (searches.data ?? []) as SavedSearch[],
  }
}
