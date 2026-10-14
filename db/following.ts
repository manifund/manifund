import 'server-only'
import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/db/supabase-admin'
import { listMySavedSearches } from '@/db/profile-follows'

// What a person follows, for the Following section of their profile (F9). Who follows whom is public there (F2),
// so it's read by server code for any visitor: the table's row-level security still lets a browser read only its
// own follows. Saved searches stay private: read with the viewer's own client, and only on their own profile.

// Flip to show saved searches to everyone who opens the profile (Vals' call, asked 2026-10-14).
export const SAVED_SEARCHES_PUBLIC = false

export type FollowedPerson = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}
export type FollowedProject = { id: string; title: string; slug: string }
export type SavedSearch = { id: string; name: string; query: string; paused_at: string | null }
export type Following = {
  people: FollowedPerson[]
  projects: FollowedProject[]
  searches: SavedSearch[] | null // null: not shown to this viewer
}

// Projects nobody else can open stay off a profile (the owner sees the rest of their list either way).
const LISTED_STAGES = ['proposal', 'active', 'complete', 'not funded']

export async function getFollowing(
  viewerClient: SupabaseClient,
  profileId: string,
  isOwnProfile: boolean
): Promise<Following> {
  const admin = createAdminClient() as any
  const [people, projects, searches] = await Promise.all([
    admin
      .from('profile_follows')
      .select(
        'created_at, followed:profiles!profile_follows_followed_id_fkey(id, username, full_name, avatar_url)'
      )
      .eq('follower_id', profileId)
      .order('created_at', { ascending: false }),
    admin
      .from('project_follows')
      .select('project_id, projects(id, title, slug, stage)')
      .eq('follower_id', profileId),
    isOwnProfile || SAVED_SEARCHES_PUBLIC
      ? isOwnProfile
        ? listMySavedSearches(viewerClient, profileId)
        : admin
            .from('saved_searches')
            .select('id, name, query, paused_at')
            .eq('owner_id', profileId)
            .order('created_at', { ascending: false })
            .then((r: any) => r.data ?? [])
      : null,
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
    searches,
  }
}
