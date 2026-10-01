import { Database } from '@/db/database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { Project } from './project'
import { Profile } from './profile'
import { TARGET_EMBEDS, type TargetEmbeds, isListed } from '@/lib/comments/links'
import type { Target } from '@/lib/comments/types'
import { withCurrentMentionLabels } from '@/lib/comments/mentions'

export type Comment = Database['public']['Tables']['comments']['Row']
export type CommentRxn = Database['public']['Tables']['comment_rxns']['Row']
export type CommentRxnWithProfile = CommentRxn & { profiles: Profile }
export type CommentAndProfile = Comment & { profiles: Profile }
export type FullComment = Comment & { profiles: Profile } & TargetEmbeds & {
    comment_rxns: CommentRxnWithProfile[]
    // For replies in feeds: whom they answer.
    parent?: { profiles: { username: string; full_name: string } | null } | null
  }

// Feed filters (the comments feed's chips): long-form updates, grant reasoning, or plain discussion.
export const FEED_FILTERS = {
  updates: ['progress update', 'final report'],
  grants: ['grant rationale'],
} as const
export type FeedFilter = keyof typeof FEED_FILTERS | 'discussion'
export type CommentAndProject = Comment & { projects: Project }
export type CommentAndProfileAndRxns = Comment & { profiles: Profile } & {
  comment_rxns: CommentRxnWithProfile[]
}
export type CommentAndProjectAndRxns = Comment &
  TargetEmbeds & {
    comment_rxns: CommentRxnWithProfile[]
  }
export type CommentAndProfileAndProject = Comment & { profiles: Profile } & {
  projects: Project
}

// Every comment on one target (project, profile or cause), with authors and reactions.
export async function getCommentsByTarget(supabase: SupabaseClient, target: Target) {
  const { data, error } = await supabase
    .from('comments')
    .select(
      '*, profiles!comments_commenter_fkey(*), comment_rxns(reactor_id, reaction, profiles!comment_rxns_reactor_id_fkey(id, username, avatar_url, full_name))'
    )
    .match(target)
  if (error) {
    throw error
  }
  return withCurrentMentionLabels(supabase, data as CommentAndProfileAndRxns[])
}

export async function getCommentsByProject(supabase: SupabaseClient, project: string) {
  return getCommentsByTarget(supabase, { project })
}

export async function getCommentById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles!comments_commenter_fkey(*), projects(*)')
    .eq('id', id)
  if (error) {
    throw error
  }
  return data[0] as CommentAndProfileAndProject
}

export async function getReplies(supabase: SupabaseClient, rootId: string) {
  const { data, error } = await supabase.from('comments').select('*').eq('replying_to', rootId)
  if (error) {
    throw error
  }
  return data as Comment[]
}

export async function getCommentsByUser(supabase: SupabaseClient, commenterId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select(
      `*, ${TARGET_EMBEDS}, comment_rxns(reactor_id, reaction, profiles!comment_rxns_reactor_id_fkey(id, username, avatar_url, full_name))`
    )
    .eq('commenter', commenterId)
    .is('deleted_at', null)
  if (error) {
    throw error
  }
  return withCurrentMentionLabels(supabase, data as CommentAndProjectAndRxns[])
}

export async function getRecentFullComments(
  supabase: SupabaseClient,
  size: number = 10,
  start: number = 0,
  filter?: FeedFilter
) {
  let query = supabase
    .from('comments')
    .select(
      `*, profiles!comments_commenter_fkey(*), ${TARGET_EMBEDS}, comment_rxns(reactor_id, reaction, profiles!comment_rxns_reactor_id_fkey(id, username, avatar_url, full_name)), parent:replying_to(profiles!comments_commenter_fkey(username, full_name))`
    )
    .is('deleted_at', null)
  if (filter === 'discussion') query = query.is('special_type', null)
  else if (filter) query = query.in('special_type', [...FEED_FILTERS[filter]])
  const { data } = await query
    .order('created_at', { ascending: false })
    .range(start, start + size)
    .throwOnError()
  // Comments on every target; hidden projects' comments stay out.
  return withCurrentMentionLabels(supabase, (data as FullComment[]).filter(isListed))
}

export async function getMinimalCommentFromId(supabase: SupabaseClient, commentId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select(`*, ${TARGET_EMBEDS}`)
    .eq('id', commentId)
  if (error) {
    throw error
  }
  return data[0] as Comment & TargetEmbeds
}
