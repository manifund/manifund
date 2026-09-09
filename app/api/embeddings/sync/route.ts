import { NextRequest, NextResponse } from 'next/server'
import {
  syncProjectEmbeddings,
  type EmbeddingModel,
  EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_MODEL,
} from '@/app/utils/embeddings'
import { isAuthorizedCron } from '@/utils/cron-auth'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)

    // Get parameters from query string with defaults
    const batchSize = parseInt(searchParams.get('batchSize') || '5')
    const force = searchParams.get('force') === 'true'
    const model = (searchParams.get('model') || DEFAULT_EMBEDDING_MODEL) as EmbeddingModel
    // Validate batch size
    if (batchSize < 1 || batchSize > 20) {
      return NextResponse.json({ error: 'Batch size must be between 1 and 20' }, { status: 400 })
    }

    console.log(`Starting embedding sync...`)

    console.log(`Batch size: ${batchSize}`)
    console.log(`Force regenerate: ${force}`)

    const results = await syncProjectEmbeddings({
      model,
      batchSize,
      force,
      onProgress: (progress) => {
        if (progress.currentProject) {
          console.log(
            `Progress: ${progress.processed}/${progress.total} (${Math.round(
              (progress.processed / progress.total) * 100
            )}%) - Processing: ${progress.currentProject}`
          )
        }
      },
    })

    console.log(`Sync complete: ${results.processed} processed, ${results.errors} errors`)

    return NextResponse.json({
      success: true,
      results,
      model,
      dimension: EMBEDDING_MODELS[model].dimension,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Embedding sync failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync embeddings',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
