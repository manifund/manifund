import { Project, TOTAL_SHARES } from '@/db/project'
import { NextRequest, NextResponse } from 'next/server'
import uuid from 'react-uuid'
import { newProjectKarma } from '@/utils/karma'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { projectSlugify, toTitleCase } from '@/utils/formatting'
import { ProjectParams } from '@/utils/upsert-project'
import { getPrizeCause, updateProjectCauses } from '@/db/cause'
import { getProposalValuation, getMinIncludingAmm } from '@/utils/math'
import { insertBid } from '@/db/bid'
import { invalidateProjectsCache } from '@/db/project-cached'
import { seedAmm } from '@/utils/activate-project'
import { upvoteOwnProject, giveCreatorShares } from '@/utils/upsert-project'
import { triggerProjectScoring } from '@/app/utils/trigger-scoring'
import { DISABLE_NEW_SIGNUPS_AND_PROJECTS, SIGNUP_DISABLED_MESSAGE } from '@/utils/constants'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export default async function handler(req: NextRequest) {
  if (DISABLE_NEW_SIGNUPS_AND_PROJECTS) {
    return NextResponse.json({ error: SIGNUP_DISABLED_MESSAGE }, { status: 503 })
  }

  const {
    title,
    subtitle,
    minFunding,
    fundingGoal,
    verdictDate,
    description,
    location,
    selectedCauses,
    selectedPrize,
    founderPercent,
    agreedToTerms,
    lobbying,
  } = (await req.json()) as ProjectParams
  const { supabase, user } = await getUserAndClient(req)
  if (!user) return NextResponse.error()

  // Check for existing project with same title by this user (prevents duplicates from double-submit)
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('creator', user.id)
    .eq('title', title)
    .limit(1)

  if (existingProjects && existingProjects.length > 0) {
    // Return existing project instead of creating duplicate
    return NextResponse.json(existingProjects[0])
  }

  const slug = await projectSlugify(title, supabase)
  const projectId = uuid()
  const defaultProject = {
    id: projectId,
    title,
    blurb: subtitle,
    description,
    min_funding: minFunding ?? 500,
    funding_goal: fundingGoal ?? minFunding ?? 0,
    founder_shares: TOTAL_SHARES,
    amm_shares: null,
    creator: user.id,
    slug,
    round: 'Regrants',
    auction_close: verdictDate,
    stage: 'proposal',
    type: 'grant',
    location_description: location,
    approved: null,
    signed_agreement: false,
    lobbying,
  } as Project

  const causeSlugs = selectedCauses.map((cause) => cause.slug)
  if (!!selectedPrize) {
    causeSlugs.push(selectedPrize.slug)
  }

  let project = defaultProject
  if (selectedPrize?.slug === 'ea-community-choice') {
    project = {
      ...defaultProject,
      round: 'EA Community Choice',
    }
  } else if (selectedPrize?.slug === 'leo-microgrants') {
    // Fixed $10k grant; min-funding field is hidden for prize rounds.
    // `round` is a FK to rounds.title and this cause has no rounds row, so bucket
    // it under the existing 'Independent' round (the cause carries its identity).
    project = {
      ...defaultProject,
      round: 'Independent',
      min_funding: 10_000,
      funding_goal: fundingGoal ?? 10_000,
    }
  } else if (selectedPrize?.slug === 'grantmaking-ai') {
    // $5k–$50k grants; min-funding field is hidden for prize rounds.
    // Like leo-microgrants, this cause has no rounds row, so bucket it under
    // 'Independent' (the cause carries its identity).
    project = {
      ...defaultProject,
      round: 'Independent',
      min_funding: 5_000,
      funding_goal: fundingGoal ?? 5_000,
    }
  } else if (selectedPrize?.slug === 'falcon-fund') {
    // Falcon Fund applications are regular proposal-stage grants. This cause has
    // no rounds row (and no cert_params), so bucket it under 'Independent'.
    project = {
      ...defaultProject,
      round: 'Independent',
    }
  } else if (selectedPrize) {
    const seedingAmm =
      selectedPrize?.cert_params?.ammShares &&
      (agreedToTerms || selectedPrize?.cert_params?.adjustableInvestmentStructure)
    project = {
      ...defaultProject,
      founder_shares: (founderPercent / 100) * TOTAL_SHARES,
      amm_shares: seedingAmm ? (selectedPrize.cert_params?.ammShares ?? null) : null,
      round: toTitleCase(selectedPrize.title),
      stage: selectedPrize.cert_params?.proposalPhase ? 'proposal' : 'active',
      type: 'cert',
    }
  }

  await supabase.from('projects').insert(project).throwOnError()
  await seedProjectKarma(projectId, user.id)
  await upvoteOwnProject(supabase, projectId, user.id)
  await updateProjectCauses(supabase, causeSlugs, project.id)
  await giveCreatorShares(supabase, projectId, user.id)
  const prizeCause = await getPrizeCause(causeSlugs, supabase)
  if (project.type === 'cert' && prizeCause) {
    const certParams = prizeCause.cert_params
    if (certParams?.proposalPhase) {
      await insertBid(supabase, {
        project: projectId,
        bidder: user.id,
        amount: getMinIncludingAmm(project),
        valuation: getProposalValuation(project),
        type: project.stage === 'proposal' ? 'assurance sell' : 'sell',
      })
    } else if (certParams?.ammDollars && project.amm_shares) {
      const supabaseAdmin = createAdminClient()
      await supabaseAdmin.from('txns').insert({
        from_id: process.env.NEXT_PUBLIC_PROD_BANK_ID,
        to_id: user.id,
        amount: certParams.ammDollars,
        token: 'USD',
        project: projectId,
        type: 'project donation',
      })
      await seedAmm(project, supabaseAdmin, certParams.ammDollars)
    }
  }

  invalidateProjectsCache()
  await triggerProjectScoring(projectId)

  return NextResponse.json(project)
}

// Service role: karma columns are not the creator's to write. Failure is fine; the hourly
// recompute fills it in.
async function seedProjectKarma(projectId: string, creatorId: string) {
  const admin = createAdminClient()
  const { data: creator } = await admin
    .from('profiles')
    .select('karma')
    .eq('id', creatorId)
    .single()
  const { karma, breakdown } = newProjectKarma(creator?.karma ?? 0)
  const { error } = await admin
    .from('projects')
    .update({ karma, karma_breakdown: breakdown })
    .eq('id', projectId)
  if (error) console.error('seedProjectKarma failed:', error)
}
