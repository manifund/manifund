import { SupabaseClient } from '@supabase/supabase-js'

// Following people and saved searches, read with the visitor's own client: the viewer's own follows, and what anyone
// follows for their profile's Following tab (F2, F9). Project follows are in db/follows.ts; the Network tab and home's
// band in db/network.ts.

// Reads with the signed-in person's client. profile_follows and saved_searches aren't in the generated types yet.

// Whether the viewer follows this person (F1).
export async function isFollowing(supabase: SupabaseClient, me: string, followedId: string) {
  const { data } = await supabase
    .from('profile_follows')
    .select('followed_id')
    .eq('follower_id', me)
    .eq('followed_id', followedId)
    .maybeSingle()
  return !!data
}

export async function listMySavedSearches(supabase: SupabaseClient, me: string) {
  const { data } = await supabase
    .from('saved_searches')
    .select('id, name, query')
    .eq('owner_id', me)
    .order('created_at', { ascending: false })
  return (data ?? []) as { id: string; name: string; query: string }[]
}

// The people the viewer follows. Everything they do is in the viewer's network (F8, F10).
export async function myFollowedIds(supabase: SupabaseClient, me: string) {
  const { data } = await supabase
    .from('profile_follows')
    .select('followed_id')
    .eq('follower_id', me)
  return ((data ?? []) as { followed_id: string }[]).map((r) => r.followed_id)
}

// What a person follows, for the Following tab of their profile (F9). It's all public (F2), so it's read with the
// visitor's own client.

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
export const LISTED_STAGES = ['proposal', 'active', 'complete', 'not funded']

export async function getFollowing(
  supabase: SupabaseClient,
  profileId: string,
  isOwnProfile: boolean
): Promise<Following> {
  const [people, projects, searches] = await Promise.all([
    supabase
      .from('profile_follows')
      .select(
        'created_at, followed:profiles!profile_follows_followed_id_fkey(id, username, full_name, avatar_url)'
      )
      .eq('follower_id', profileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_follows')
      .select('project_id, projects(id, title, slug, stage)')
      .eq('follower_id', profileId),
    supabase
      .from('saved_searches')
      .select('id, name, query')
      .eq('owner_id', profileId)
      .order('created_at', { ascending: false }),
  ])
  return {
    // the embeds are one row each; the generated types can't tell, so they type them as arrays
    people: ((people.data ?? []) as unknown as { followed: FollowedPerson | null }[])
      .map((r) => r.followed)
      .filter((p): p is FollowedPerson => !!p),
    projects: (
      (projects.data ?? []) as unknown as {
        projects: (FollowedProject & { stage: string }) | null
      }[]
    )
      .map((r) => r.projects)
      .filter((p): p is FollowedProject & { stage: string } => !!p)
      .filter((p) => isOwnProfile || LISTED_STAGES.includes(p.stage))
      .map(({ id, title, slug }) => ({ id, title, slug })),
    searches: (searches.data ?? []) as SavedSearch[],
  }
}
