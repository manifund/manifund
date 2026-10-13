import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { log } from '@/lib/log'
import type { CommentRow, Recipient } from '@/lib/comments/types'
import { pickRecipients } from './pick'
import { emailModeFor, initialEmailStatus } from './groups'

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
  // Each person's email choice for this reason's group (N3): instant -> 'pending' (sent right away
  // by send.ts), weekly -> 'digest' (the weekly summary, N6), off (unsubscribed, N7) -> 'skipped'.
  const overrides = new Map<string, Partial<Record<string, string>>>()
  const { data: settings, error: settingsError } = await (admin as any)
    .from('notification_settings')
    .select('profile_id, group_key, email')
    .in(
      'profile_id',
      picked.map((r) => r.id)
    )
  if (settingsError) log.error('notifications.settings_load_failed', { error: settingsError })
  for (const s of settings ?? []) {
    overrides.set(s.profile_id, { ...(overrides.get(s.profile_id) ?? {}), [s.group_key]: s.email })
  }
  const rows = picked.map((r) => {
    const status =
      r.email === false
        ? 'skipped'
        : initialEmailStatus(emailModeFor(r.reason, overrides.get(r.id) ?? {}))
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
            ? 'email off in settings'
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
