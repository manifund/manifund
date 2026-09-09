import { updateProject, getProjectById } from '@/db/project'
import { invalidateProjectsCache } from '@/db/project-cached'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { createUpdateFromParams, ProjectParams } from '@/utils/upsert-project'
import { getPrizeCause } from '@/db/cause'
import { getProposalValuation, getMinIncludingAmm } from '@/utils/math'
import { seedAmm } from '@/utils/activate-project'
import { insertBid } from '@/db/bid'
import { triggerProjectScoring } from '@/app/utils/trigger-scoring'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export default async function handler(req: NextRequest) {
  const { projectParams, projectId } = (await req.json()) as {
    projectParams: ProjectParams
    projectId: string
  }
  const { supabase, user } = await getUserAndClient(req)
  if (!user) return NextResponse.error()
  const existingProject = await getProjectById(supabase, projectId)
  if (existingProject.creator !== user.id) {
    return NextResponse.json({ error: 'Not your project' }, { status: 403 })
  }
  if (existingProject.stage !== 'draft') {
    return NextResponse.json({ error: 'Only draft projects can be published' }, { status: 400 })
  }
  const causeSlugs = projectParams.selectedCauses.map((cause) => cause.slug)
  const selectedPrize = projectParams.selectedPrize
  const startingStage =
    selectedPrize && !selectedPrize.cert_params?.proposalPhase ? 'active' : 'proposal'
  const type = !!selectedPrize ? 'cert' : 'grant'
  const projectUpdate = createUpdateFromParams(projectParams)
  await updateProject(supabase, projectId, {
    ...projectUpdate,
    stage: startingStage,
  })
  const updatedProject = await getProjectById(supabase, projectId)
  const prizeCause = await getPrizeCause(causeSlugs, supabase)
  if (type === 'cert' && prizeCause) {
    const certParams = prizeCause.cert_params
    if (certParams?.proposalPhase) {
      await insertBid(supabase, {
        project: projectId,
        bidder: user.id,
        amount: getMinIncludingAmm(updatedProject),
        valuation: getProposalValuation(updatedProject),
        type: startingStage === 'proposal' ? 'assurance sell' : 'sell',
      })
    } else if (certParams?.ammDollars && updatedProject.amm_shares) {
      const supabaseAdmin = createAdminClient()
      const { error } = await supabaseAdmin.from('txns').insert({
        from_id: process.env.NEXT_PUBLIC_PROD_BANK_ID,
        to_id: user.id,
        amount: certParams.ammDollars,
        token: 'USD',
        project: projectId,
        type: 'project donation',
      })
      if (error) {
        console.error(error)
        throw error
      }
      await seedAmm(updatedProject, supabaseAdmin, certParams.ammDollars)
    }
  }

  invalidateProjectsCache()
  await triggerProjectScoring(projectId)

  return NextResponse.json('success')
}
