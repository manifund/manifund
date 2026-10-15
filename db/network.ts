import { SupabaseClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/core'
import type { NetworkActivity, NetworkKind } from '@/lib/follows/network'
import { log } from '@/lib/log'
import { TARGET_EMBEDS, commentHref, isListed, targetTitle } from '@/lib/comments/links'
import { toPlaintext } from '@/utils/tiptap-parsing'
import { LISTED_STAGES, myFollowedIds } from './profile-follows'

// What people the viewer follows did (docs/product/follows, F8, F10-F12): home's band above cards and the Network
// tab, read with the viewer's own client. The shared types and wording are in lib/follows/network.ts, which browser
// code imports too, so the queries live here.

const PROFILE = 'id, username, full_name, avatar_url'

type MiniProfile = { id: string; username: string; full_name: string; avatar_url: string | null }
type MiniProject = { title: string; slug: string; stage?: string }

// One thing someone you follow did. `projectId` is null for a comment on a profile or an org page.
type FeedBase = { id: string; at: string; who: MiniProfile; projectId: string | null }
export type NetworkFeedItem =
  | (FeedBase & { kind: 'created'; project: MiniProject })
  | (FeedBase & { kind: 'donated'; amount: number; project: MiniProject })
  | (FeedBase & { kind: 'offered'; amount: number; project: MiniProject })
  | (FeedBase & {
      kind: 'commented'
      href: string
      target: string
      excerpt: string
      label: string | null
    })

// F12: what people you follow did, newest first, with the details the Network tab shows: the newest `limit` of each
// kind (their projects, donations, offers, comments anywhere). Comments on hidden projects or org pages, drafts and
// hidden projects stay out. (Home's line uses network_activity() instead: one row per project, person and kind.)
async function networkEvents(
  supabase: SupabaseClient,
  followed: string[],
  limit: number
): Promise<NetworkFeedItem[]> {
  if (!followed.length) return []
  const newest = <Q extends { order: Function }>(q: Q): Q =>
    (q.order('created_at', { ascending: false }) as any).limit(limit)
  const [projects, txns, bids, comments] = await Promise.all([
    newest(
      supabase
        .from('projects')
        .select(`id, title, slug, stage, created_at, profiles!projects_creator_fkey(${PROFILE})`)
        .in('creator', followed)
        .in('stage', LISTED_STAGES)
    ),
    newest(
      supabase
        .from('txns')
        .select(
          `id, amount, created_at, project, profiles!txns_from_id_fkey(${PROFILE}), projects(title, slug, stage)`
        )
        .in('from_id', followed)
        .eq('type', 'project donation')
        .not('project', 'is', null)
    ),
    newest(
      supabase
        .from('bids')
        .select(
          `id, amount, created_at, project, profiles!bids_bidder_fkey(${PROFILE}), projects(title, slug, stage)`
        )
        .in('bidder', followed)
        .eq('status', 'pending')
        .in('type', ['donate', 'assurance buy'])
    ),
    newest(
      supabase
        .from('comments')
        .select(
          `id, created_at, content, special_type, project, org_id, profiles!comments_commenter_fkey(${PROFILE}), ${TARGET_EMBEDS}`
        )
        .in('commenter', followed)
        .is('deleted_at', null)
    ),
  ])
  const listedProject = (p: MiniProject | null) => !!p && LISTED_STAGES.includes(p.stage ?? '')
  const items: NetworkFeedItem[] = [
    ...((projects.data ?? []) as any[]).map((p) => ({
      kind: 'created' as const,
      id: p.id,
      at: p.created_at,
      who: p.profiles,
      projectId: p.id,
      project: { title: p.title, slug: p.slug, stage: p.stage },
    })),
    ...((txns.data ?? []) as any[])
      .filter((t) => listedProject(t.projects))
      .map((t) => ({
        kind: 'donated' as const,
        id: t.id,
        at: t.created_at,
        who: t.profiles,
        projectId: t.project,
        amount: t.amount,
        project: t.projects,
      })),
    ...((bids.data ?? []) as any[])
      .filter((b) => listedProject(b.projects))
      .map((b) => ({
        kind: 'offered' as const,
        id: b.id,
        at: b.created_at,
        who: b.profiles,
        projectId: b.project,
        amount: b.amount,
        project: b.projects,
      })),
    ...((comments.data ?? []) as any[]).filter(isListed).map((c) => ({
      kind: 'commented' as const,
      id: c.id,
      at: c.created_at,
      who: c.profiles,
      projectId: c.project ?? null,
      href: commentHref(c),
      target: targetTitle(c),
      excerpt: excerpt(c.content),
      label: c.special_type ?? null,
    })),
  ]
  return items
    .filter((i) => i.who)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

// For a page: by project, what people you follow did there, as a plain object a client component can take;
// undefined when they follow nobody, so home stays exactly as for everyone else (F10).
export async function networkFor(
  supabase: SupabaseClient,
  me: string
): Promise<NetworkActivity | undefined> {
  if (!(await myFollowedIds(supabase, me)).length) return undefined
  // network_activity() reads the signed-in person's follows (auth.uid()), so `supabase` must be theirs
  const { data, error } = await supabase.rpc('network_activity' as any)
  if (error) log.error('follows.network_activity_failed', { error })
  const out: NetworkActivity = {}
  for (const r of (data ?? []) as { project_id: string; name: string; kind: NetworkKind }[])
    (out[r.project_id] ??= []).push({ name: r.name, kind: r.kind })
  return out
}

// F12: the Network tab, newest first.
export async function networkFeed(supabase: SupabaseClient, me: string, limit = 50) {
  const followed = await myFollowedIds(supabase, me)
  return (await networkEvents(supabase, followed, limit)).slice(0, limit)
}

function excerpt(content: JSONContent | null) {
  if (!content) return ''
  const text = toPlaintext(content).replace(/\s+/g, ' ').trim()
  return text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text
}
