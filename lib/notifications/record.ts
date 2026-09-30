import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { log } from '@/lib/log'
import { REASONS, type CommentRow, type Recipient } from '@/lib/comments/types'

// One notification per person per comment: when several reasons apply, the earliest in REASONS
// wins. The author never notifies themselves. Never throws: a comment without its notifications is
// logged, not failed (decided 2026-09-28).
// actorId: who acted (the author for a new comment, a moderator for a moderation).
export async function recordCommentNotifications(
  comment: CommentRow,
  recipients: Recipient[],
  actorId: string = comment.commenter
) {
  const best = new Map<string, Recipient>()
  for (const r of recipients) {
    if (!r.id || r.id === actorId) continue
    const current = best.get(r.id)
    if (!current || REASONS.indexOf(r.reason) < REASONS.indexOf(current.reason)) {
      // An email covered elsewhere stays covered even if a stronger reason wins.
      best.set(r.id, { ...r, email: (r.email ?? true) && (current?.email ?? true) })
    }
  }
  const rows = [...best.values()].map((r) => ({
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
