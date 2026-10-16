import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { log } from '@/lib/log'
import type { CommentRow, Recipient } from '@/lib/comments/types'
import { pickRecipients } from './pick'
import { emailModeFor, initialEmailStatus } from './kinds'
import { loadEmailChoices } from './settings'

// Records the notifications for a comment. Never throws: a comment without its notifications is
// logged, not failed (decided 2026-09-28). actorId: who acted (the author for a new comment, a
// moderator for a moderation).
export async function recordCommentNotifications(
  comment: CommentRow,
  recipients: Recipient[],
  actorId: string = comment.commenter
) {
  const picked = pickRecipients(recipients, actorId)
  if (picked.length === 0) return 0
  const admin = createAdminClient()
  // Each person's email choice (N4): immediate -> 'pending' (sent right away by send.ts), daily -> 'digest' (the
  // daily summary, N5), never -> 'skipped'. Moderation is essential: always right away (N3).
  const choices = await loadEmailChoices(picked.map((r) => r.id))
  const rows = picked.map((r) => {
    const status =
      r.email === false ? 'skipped' : initialEmailStatus(emailModeFor(r.reason, choices.get(r.id)))
    return {
      recipient_id: r.id,
      reason: r.reason,
      comment_id: comment.id,
      actor_id: actorId,
      email_status: status,
      last_error:
        r.email === false
          ? 'covered by another email'
          : status === 'skipped'
            ? 'email set to never'
            : null,
    }
  })
  const { error } = await admin
    .from('notifications')
    .upsert(rows, { onConflict: 'recipient_id,comment_id', ignoreDuplicates: true })
  if (error) {
    log.error('notifications.record_failed', { comment_id: comment.id, count: rows.length, error })
    return 0
  }
  log.info('notifications.recorded', { comment_id: comment.id, count: rows.length })
  return rows.length
}
