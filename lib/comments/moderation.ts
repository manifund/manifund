import 'server-only'
import type { JSONContent } from '@tiptap/core'
import { createAdminClient } from '@/db/supabase-admin'
import type { Profile } from '@/db/profile'
import { log } from '@/lib/log'
import { toMarkdown } from '@/utils/tiptap-parsing'
import { sendDiscordAlert } from '@/utils/discord'
import { checkLinks } from '@/app/utils/link-check'
import {
  CATEGORY_LABELS,
  classifyComment,
  hasModerationKeys,
  type CommentCategory,
} from '@/app/utils/ai-moderation'
import type { CommentRow } from './types'

// AI moderation of comments (C38-C42). Runs after the comment is saved; a flagged comment is held:
// shown collapsed as "hidden pending review", with an AI report in the admins' queue.

export type CommentVerdict = { categories: CommentCategory[]; reason: string; model: string }

// The link check first (C39): a hit holds without asking the model. Null = fine (or unavailable).
export async function moderate(
  comment: CommentRow,
  author: Pick<Profile, 'username' | 'full_name'>,
  targetTitle: string
): Promise<CommentVerdict | null> {
  const content = comment.content as JSONContent | null
  const badLink = await checkLinks(content)
  if (badLink) return { categories: ['scam_phishing'], reason: badLink, model: 'link-check' }
  if (!hasModerationKeys() || !content) return null
  const text = toMarkdown(content).trim()
  if (!text) return null
  const verdict = await classifyComment({
    text,
    authorUsername: author.username,
    authorName: author.full_name ?? '',
    targetTitle,
  })
  return verdict?.flagged
    ? { categories: verdict.categories, reason: verdict.reason, model: verdict.model }
    : null
}

// Hold the comment (C40): flag it, file the AI report, alert the admins. Doxxing also moves the
// words out of the public row into held_comment_content until an admin decides.
export async function hold(comment: CommentRow, verdict: CommentVerdict, href: string) {
  const admin = createAdminClient()
  let moveWords = verdict.categories.includes('doxxing') && !!comment.content
  if (moveWords) {
    const { error } = await admin
      .from('held_comment_content')
      .upsert({ comment_id: comment.id, content: comment.content })
    if (error) {
      // Without a safe copy, don't null the words: hold it with them visible behind the click.
      log.error('comment.hold_copy_failed', { comment_id: comment.id, error })
      moveWords = false
    }
  }
  const { error } = await admin
    .from('comments')
    .update({
      held_at: new Date().toISOString(),
      held_categories: verdict.categories,
      ...(moveWords ? { content: null } : {}),
    })
    .eq('id', comment.id)
    .is('deleted_at', null)
  if (error) {
    log.error('comment.hold_failed', { comment_id: comment.id, error })
    return
  }
  // One open AI report per comment: re-holding after an edit updates it.
  await admin
    .from('comment_reports')
    .delete()
    .eq('comment_id', comment.id)
    .eq('source', 'ai')
    .is('resolved_at', null)
  await admin.from('comment_reports').insert({
    comment_id: comment.id,
    reporter_id: null,
    source: 'ai',
    categories: verdict.categories,
    is_spam: verdict.categories.includes('spam') || verdict.categories.includes('scam_phishing'),
    note: `[${verdict.model}] ${verdict.reason}`.slice(0, 2000),
  })
  log.warn('comment.held', { comment_id: comment.id, categories: verdict.categories })
  await sendDiscordAlert(
    `🚩 Comment held for review (${verdict.categories
      .map((c) => CATEGORY_LABELS[c] ?? c)
      .join(', ')}): ${verdict.reason}\nhttps://manifund.org${href}\nQueue: https://manifund.org/admin/comment-reports`
  )
}

// Undo a hold (C41): clear the flags and put moved words back. Returns the comment as it now stands.
export async function release(commentId: string): Promise<CommentRow | null> {
  const admin = createAdminClient()
  const { data: moved } = await admin
    .from('held_comment_content')
    .select('content')
    .eq('comment_id', commentId)
    .maybeSingle()
  const { data: comment, error } = await admin
    .from('comments')
    .update({
      held_at: null,
      held_categories: null,
      ...(moved ? { content: moved.content } : {}),
    })
    .eq('id', commentId)
    .select()
    .single()
  if (error || !comment) {
    log.error('comment.release_failed', { comment_id: commentId, error })
    return null
  }
  if (moved) await admin.from('held_comment_content').delete().eq('comment_id', commentId)
  return comment
}

// The words of a held-for-doxxing comment, for its author and admins.
export async function heldContent(commentId: string): Promise<JSONContent | null> {
  const { data } = await createAdminClient()
    .from('held_comment_content')
    .select('content')
    .eq('comment_id', commentId)
    .maybeSingle()
  return (data?.content as JSONContent) ?? null
}
