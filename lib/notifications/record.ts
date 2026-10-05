import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { log } from '@/lib/log'
import type { CommentRow, Recipient } from '@/lib/comments/types'
import { pickRecipients } from './pick'

// Records the notifications for a comment. Never throws: a comment without its notifications is
// logged, not failed (decided 2026-09-28). actorId: who acted (the author for a new comment, a
// moderator for a moderation).
export async function recordCommentNotifications(
  comment: CommentRow,
  recipients: Recipient[],
  actorId: string = comment.commenter
) {
  const rows = pickRecipients(recipients, actorId).map((r) => ({
    recipient_id: r.id,
    reason: r.reason,
    comment_id: comment.id,
    actor_id: actorId,
    email_status: r.email === false ? 'skipped' : 'pending',
    last_error: r.email === false ? 'covered by another email' : null,
  }))
  if (rows.length === 0) return 0
  const { error } = await createAdminClient()
    .from('notifications')
    .upsert(rows, { onConflict: 'recipient_id,comment_id', ignoreDuplicates: true })
  if (error) {
    log.error('notifications.record_failed', { comment_id: comment.id, count: rows.length, error })
    return 0
  }
  log.info('notifications.recorded', { comment_id: comment.id, count: rows.length })
  return rows.length
}
