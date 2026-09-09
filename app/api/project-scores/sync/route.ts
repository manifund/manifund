import { NextRequest, NextResponse } from 'next/server'
import { syncProjectScores, hasScoringKeys } from '@/app/utils/project-scores'
import { createAdminClient } from '@/db/supabase-admin'
import { isAuthorizedCron } from '@/utils/cron-auth'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    if (!hasScoringKeys()) {
      return NextResponse.json(
        { error: 'Missing PANGRAM_API_KEY or OPENROUTER_API_KEY' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const batchSize = parseInt(searchParams.get('batchSize') || '5')
    const limit = parseInt(searchParams.get('limit') || '30')
    const force = searchParams.get('force') === 'true'

    if (batchSize < 1 || batchSize > 20) {
      return NextResponse.json({ error: 'Batch size must be between 1 and 20' }, { status: 400 })
    }

    console.log(
      `Starting project score sync (batchSize=${batchSize}, limit=${limit}, force=${force})`
    )

    const results = await syncProjectScores(createAdminClient(), {
      batchSize,
      limit,
      force,
      onProgress: (progress) => {
        console.log(
          `Progress: ${progress.processed}/${progress.total} - ${progress.currentProject ?? ''}`
        )
      },
    })

    console.log(
      `Score sync complete: ${results.scored} scored, ${results.partial} partial, ${results.failed} failed`
    )

    return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Project score sync failed:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
