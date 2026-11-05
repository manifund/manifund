import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/utils/cron-auth'
import { createAdminClient } from '@/db/supabase-admin'
import { sendDiscordAlert } from '@/utils/discord'
import { sendPendingEmails } from '@/lib/notifications/send'
import { log } from '@/lib/log'
import { checkThenNotify } from '@/lib/comments'

export const runtime = 'nodejs'
export const maxDuration = 300
const STALE_MINUTES = 30

// Backup sender (cron, every 10 minutes): finishes comment checks that didn't run after posting, emails comment notifications that the after-response send missed,
// then alerts if any has waited longer than 30 minutes, which means sending is failing. Only comment rows count:
// they're the ones this sweep can resend (claim_notification_emails), so another kind stuck in 'sending' can't
// raise an alert that never clears.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Comments whose after-response check never finished (C38): check them now, so they notify (or are held).
  const { data: unchecked } = await createAdminClient()
    .from('comments')
    .select('*, author:profiles!comments_commenter_fkey(username, full_name)')
    .is('moderated_at', null)
    .is('deleted_at', null)
    .lt('created_at', new Date(Date.now() - 2 * 60_000).toISOString())
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .limit(50)
  for (const { author, ...comment } of unchecked ?? []) {
    if (author) await checkThenNotify(comment as any, author)
  }
  if (unchecked?.length) log.warn('comments.checked_late', { count: unchecked.length })

  const summary = await sendPendingEmails({ minAgeSeconds: 60, limit: 200 })

  const { count } = await createAdminClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('email_status', ['pending', 'sending'])
    .not('comment_id', 'is', null)
    .lt('created_at', new Date(Date.now() - STALE_MINUTES * 60_000).toISOString())
  const stale = count ?? 0
  log.info('notifications.sweep', { ...summary, stale })
  if (stale > 0) {
    log.error('notifications.backlog', { stale })
    await sendDiscordAlert(
      `Notifications: ${stale} email(s) unsent for over ${STALE_MINUTES} minutes`
    )
  }
  return NextResponse.json({ ...summary, stale })
}
