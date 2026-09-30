import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { getUserEmail } from '@/utils/email'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { rulesFor, targetOf } from '@/lib/comments/targets'
import type { JSONContent } from '@tiptap/core'
import type { Reason } from '@/lib/comments/types'
import { emailFor } from './templates'

const MAX_ATTEMPTS = 5

export type SendSummary = {
  claimed: number
  sent: number
  skipped: number
  failed: number
  retry: number
}

// Email the notifications that are due. Called right after a post (only that comment's rows) and
// by the backup sweep (rows older than a minute). Rows are claimed first, so the two never send the
// same row; a row is marked 'sent' only once Postmark accepted it.
export async function sendPendingEmails(opts: {
  commentId?: string
  minAgeSeconds?: number
  limit?: number
}): Promise<SendSummary> {
  const admin = createAdminClient()
  const summary: SendSummary = { claimed: 0, sent: 0, skipped: 0, failed: 0, retry: 0 }
  const { data: rows, error } = await admin.rpc('claim_notification_emails', {
    p_comment_id: opts.commentId ?? null,
    p_min_age: `${opts.minAgeSeconds ?? 0} seconds`,
    p_limit: opts.limit ?? 50,
  })
  if (error) {
    log.error('notifications.claim_failed', { error })
    return summary
  }
  summary.claimed = rows?.length ?? 0
  const token = process.env.POSTMARK_SERVER_TOKEN
  const comments = new Map<string, Awaited<ReturnType<typeof loadComment>>>()

  for (const row of rows ?? []) {
    const mark = (fields: Record<string, unknown>) =>
      admin.from('notifications').update(fields).eq('id', row.id).throwOnError()
    try {
      if (!token) {
        await mark({ email_status: 'skipped', last_error: 'email disabled (no Postmark token)' })
        summary.skipped++
        continue
      }
      const commentId = row.comment_id ?? ''
      if (!comments.has(commentId)) comments.set(commentId, await loadComment(commentId))
      const comment = comments.get(commentId)
      const to = await getUserEmail(admin, row.recipient_id)
      if (!comment || !to) {
        await mark({ email_status: 'skipped', last_error: !comment ? 'comment gone' : 'no email' })
        summary.skipped++
        continue
      }
      const email = emailFor({ reason: row.reason as Reason, ...comment })
      const error = await postmark(token, to, email.templateId, email.model)
      if (!error) {
        await mark({ email_status: 'sent', emailed_at: new Date().toISOString(), last_error: null })
        summary.sent++
      } else if (row.email_attempts >= MAX_ATTEMPTS) {
        await mark({ email_status: 'failed', last_error: error })
        summary.failed++
        log.error('notifications.email_failed', { notification_id: row.id, error })
      } else {
        await mark({ email_status: 'pending', last_error: error })
        summary.retry++
        log.warn('notifications.email_retry', {
          notification_id: row.id,
          attempt: row.email_attempts,
          error,
        })
      }
    } catch (e) {
      // Left in 'sending': the sweep picks it up again after 10 minutes.
      log.error('notifications.send_crashed', { notification_id: row.id, error: e })
    }
  }
  if (summary.claimed) log.info('notifications.sent', { comment_id: opts.commentId, ...summary })
  return summary
}

async function loadComment(id: string) {
  const { data } = await createAdminClient()
    .from('comments')
    .select('*, profiles!comments_commenter_fkey(username, avatar_url)')
    .eq('id', id)
    .maybeSingle()
    .throwOnError()
  if (!data) return undefined
  const target = targetOf(data)
  const rules = rulesFor(target)
  const ctx = await rules.load(target)
  if (!ctx) return undefined
  const label = rules.label(ctx)
  return {
    content: (data.content ?? { type: 'doc', content: [] }) as JSONContent,
    moderation: data.deleted_at
      ? { action: 'removed' as const, note: data.removed_reason ?? '' }
      : data.edit_note
        ? { action: 'edited' as const, note: data.edit_note }
        : undefined,
    commenter: data.profiles as { username: string; avatar_url: string | null },
    target: { title: label.title, url: `${getURL()}${label.href.replace(/^\//, '')}#${id}` },
  }
}

// Returns null when Postmark accepted the email, else an error message.
async function postmark(token: string, to: string, templateId: number, model: object) {
  try {
    const res = await fetch('https://api.postmarkapp.com/email/withTemplate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: 'info@manifund.org',
        To: to,
        TemplateId: templateId,
        TemplateModel: model,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { ErrorCode?: number; Message?: string }
    return res.ok && json.ErrorCode === 0
      ? null
      : `postmark ${res.status}: ${json.Message ?? 'unknown'}`
  } catch (e) {
    return `postmark unreachable: ${(e as Error).message}`
  }
}
