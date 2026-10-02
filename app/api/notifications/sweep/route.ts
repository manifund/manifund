import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/utils/cron-auth'
import { createAdminClient } from '@/db/supabase-admin'
import { sendDiscordAlert } from '@/utils/discord'
import { sendPendingEmails } from '@/lib/notifications/send'
import { log } from '@/lib/log'

export const runtime = 'nodejs'
export const maxDuration = 300
const STALE_MINUTES = 30

// Backup sender (cron, every 10 minutes): emails notifications that the after-response send missed,
// then alerts if anything has waited longer than 30 minutes, which means sending is failing.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const summary = await sendPendingEmails({ minAgeSeconds: 60, limit: 200 })

  const { count } = await createAdminClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('email_status', ['pending', 'sending'])
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
