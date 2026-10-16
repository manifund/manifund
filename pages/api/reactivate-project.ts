import { NextRequest, NextResponse } from 'next/server'
import { invalidateProjectsCache } from '@/db/project-cached'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { getProjectWithCausesById } from '@/db/project'
import { getPrizeCause } from '@/db/cause'
import { checkReactivateEligible } from '@/utils/activate-project'
import { SupabaseClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export default async function handler(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId: string }
  const { supabase, user } = await getUserAndClient(req)
  const project = await getProjectWithCausesById(supabase, projectId)
  if (!project || !user || user.id !== project.creator) {
    console.error('no project or user')
    return Response.error()
  }
  const prizeCause = await getPrizeCause(
    project.causes.map((c) => c.slug),
    supabase
  )
  if (!checkReactivateEligible(project, prizeCause)) {
    console.error('not eligible')
    return Response.error()
  }
  // Only the server moves a project to active; the checks above are what allow it here.
  await reactivateProject(createAdminClient(), projectId)

  invalidateProjectsCache()

  return NextResponse.json('success')
}

async function reactivateProject(supabase: SupabaseClient, projectId: string) {
  const { error } = await supabase
    .from('projects')
    .update({ stage: 'active', amm_shares: 0 })
    .eq('id', projectId)
  if (error) {
    console.error(error)
  }
}
