import { NextRequest, NextResponse } from 'next/server'
import { getUserAndClient } from '@/db/edge'
import { invalidateProjectsCache } from '@/db/project-cached'
import { getProjectById, updateProjectStage } from '@/db/project'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

type HideProjectProps = {
  projectId: string
}

export default async function handler(req: NextRequest) {
  const { projectId } = (await req.json()) as HideProjectProps
  const { supabase, user } = await getUserAndClient(req)
  const project = await getProjectById(supabase, projectId)
  if (!user || user.id !== project.creator) return NextResponse.error()
  // An approved project stays public as the record of what was funded (P7); the database refuses it too.
  if (project.approved === true) {
    return NextResponse.json('Approved projects cannot be hidden.', { status: 403 })
  }

  await updateProjectStage(supabase, projectId, 'hidden')
  invalidateProjectsCache()

  return NextResponse.json('success')
}
