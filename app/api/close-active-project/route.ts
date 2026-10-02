import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById } from '@/db/profile'
import { getProjectById, updateProjectStage } from '@/db/project'
import { invalidateProjectsCache } from '@/db/project-cached'
import { post } from '@/lib/comments'

// Moved from pages/api (Edge) to App Router (Node) in the comments POC. The final report is posted
// first (so an empty or invalid report doesn't close the project), then the project completes.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { projectId, reportContent } = (await req.json()) as {
    projectId: string
    reportContent: JSONContent
  }
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const project = await getProjectById(supabase, projectId)
  if (!user || !project || user.id !== project.creator) {
    return NextResponse.json({ error: 'only the creator can close a project' }, { status: 403 })
  }
  const author = await getProfileById(supabase, user.id)
  if (!author) return NextResponse.json({ error: 'profile not found' }, { status: 404 })
  const report = await post(
    author,
    { target: { project: projectId }, content: reportContent, type: 'final report' },
    'server'
  )
  if (!report.ok) return NextResponse.json({ error: report.message }, { status: report.status })
  await updateProjectStage(supabase, projectId, 'complete')
  invalidateProjectsCache()
  return NextResponse.json('success')
}
