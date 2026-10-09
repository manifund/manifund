import { NextRequest, NextResponse } from 'next/server'
import { recomputeKarma } from '@/db/karma'
import { createAdminClient } from '@/db/supabase-admin'
import { invalidateProjectsCache } from '@/db/project-cached'
import { isAuthorizedCron } from '@/utils/cron-auth'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await recomputeKarma(createAdminClient())
    invalidateProjectsCache()
    console.log('Karma sync:', summary)
    return NextResponse.json({ success: true, ...summary, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Karma sync failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
