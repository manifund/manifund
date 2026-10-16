import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/utils/cron-auth'
import { sendDailySummary } from '@/lib/notifications/summary'

export const runtime = 'nodejs'
export const maxDuration = 300

// The daily summary (cron, N5): see lib/notifications/summary.ts.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await sendDailySummary())
}
