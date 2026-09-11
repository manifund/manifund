import { NextRequest, NextResponse } from 'next/server'
import { invalidateProjectsCache } from '@/db/project-cached'
import { updateProjectCauses } from '@/db/cause'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { ProjectUpdate, updateProject } from '@/db/project'
import { isAdmin } from '@/db/profile'
import { triggerProjectScoring } from '@/app/utils/trigger-scoring'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

const CREATOR_EDITABLE_FIELDS = [
  'title',
  'blurb',
  'description',
  'min_funding',
  'funding_goal',
  'founder_shares',
  'auction_close',
  'location_description',
  'lobbying',
]

export default async function handler(req: NextRequest) {
  const { projectUpdate, projectId, causeSlugs } = (await req.json()) as {
    projectUpdate: ProjectUpdate
    projectId: string
    causeSlugs: string[]
  }
  const { supabase: supabaseEdge, user } = await getUserAndClient(req)
  const supabase = isAdmin(user) ? createAdminClient() : supabaseEdge
  if (!user) return NextResponse.error()
  const update = isAdmin(user)
    ? { ...projectUpdate }
    : // Non-admins may only edit the fields the project forms expose
      (Object.fromEntries(
        Object.entries(projectUpdate).filter(([key]) => CREATOR_EDITABLE_FIELDS.includes(key))
      ) as ProjectUpdate)
  // Score columns are server-managed; never accept them from the client
  delete update.ai_fraction
  delete update.quality_score
  await updateProject(supabase, projectId, update)
  console.log(causeSlugs)
  await updateProjectCauses(supabase, causeSlugs, projectId)

  invalidateProjectsCache()
  await triggerProjectScoring(projectId)

  return NextResponse.json('success')
}
