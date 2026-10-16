import { NextRequest, NextResponse } from 'next/server'
import { syncProjectAiEvals, hasAiEvalKeys } from '@/app/utils/project-ai-evals'
import { createAdminClient } from '@/db/supabase-admin'
import { isAuthorizedCron } from '@/utils/cron-auth'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasAiEvalKeys()) {
    return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 })
  }
  try {
    const results = await syncProjectAiEvals(createAdminClient())
    console.log(`AI eval sync: ${JSON.stringify(results)}`)
    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('AI eval sync failed:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
