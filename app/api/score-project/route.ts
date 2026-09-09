import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/utils/cron-auth'
import { waitUntil } from '@vercel/functions'
import { updateProjectEmbedding } from '@/app/utils/embeddings'
import { scoreProject } from '@/app/utils/project-scores'
import {
  classifyProjectSpam,
  handleSpamProject,
  hasSpamScoringKeys,
  recordSpamVerdict,
} from '@/app/utils/spam-scores'
import { createAdminClient } from '@/db/supabase-admin'
import { invalidateProjectsCache } from '@/db/project-cached'
import { SPAM_FILTER_ENABLED, SPAM_FILTER_ENFORCE } from '@/utils/constants'

// Embeds and slop-scores a single project in the background. The on-create/
// on-edit hooks live in Pages Router edge functions, where waitUntil doesn't
// reliably outlive the response and Pangram's ~2min polling exceeds edge
// limits anyway - so they instead await a quick fetch to this Node route,
// which ACKs with a 202 and finishes the work via waitUntil.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = (await request.json()) as { projectId?: string }
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  // The Pages Router callers can't revalidateTag themselves (App Router-only
  // API), so the projects cache is refreshed here on their behalf
  invalidateProjectsCache()

  // Spam gate runs first and blocks: an obvious ad/scam must be hidden or the
  // author banned before we spend a Pangram call on it. Everything that isn't
  // spam (or if the classifier is unavailable) proceeds to normal scoring.
  const admin = createAdminClient()
  if (SPAM_FILTER_ENABLED && hasSpamScoringKeys()) {
    const { data: project } = await admin
      .from('projects')
      .select('id, title, blurb, slug, creator, description')
      .eq('id', projectId)
      .single()
    if (project) {
      const verdict = await classifyProjectSpam(project as any)
      if (verdict.is_spam) {
        if (SPAM_FILTER_ENFORCE) {
          await handleSpamProject(admin, project as any, verdict)
          invalidateProjectsCache()
          return NextResponse.json({ spam: true, projectId }, { status: 202 })
        }
        // Shadow mode: record the verdict but let the project through so we can
        // audit accuracy on live traffic before enabling enforcement.
        await recordSpamVerdict(admin, projectId, verdict).catch((e) =>
          console.error('recordSpamVerdict failed:', e)
        )
      }
    }
  }

  waitUntil(
    updateProjectEmbedding(projectId).catch((error) => {
      console.error(`Failed to embed project ${projectId}:`, error)
    })
  )
  waitUntil(
    scoreProject(admin, projectId).catch((error) => {
      console.error(`Failed to score project ${projectId}:`, error)
    })
  )

  return NextResponse.json({ started: true, projectId }, { status: 202 })
}
