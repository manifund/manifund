import { getProjectAndBidsById, getProjectById } from '@/db/project'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { getProfileById } from '@/db/profile'
import { getTxnAndProjectsByUser, getTxnsByProject } from '@/db/txn'
import { getPendingBidsByUser } from '@/db/bid'
import { calculateCharityBalance, getAmountRaised } from '@/utils/math'
import { donationLimitError, fundingLeft } from '@/utils/donation-limits'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { getURL } from '@/utils/constants'
import { isAdmin } from '@/db/profile'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

// May add optional project field for regrantors later
type MoneyTransferProps = {
  fromId: string
  toId: string
  amount: number
  projectId?: string
}

export default async function handler(req: NextRequest) {
  const { fromId, toId, amount, projectId } = (await req.json()) as MoneyTransferProps
  const { supabase, user } = await getUserAndClient(req)
  if (user?.id !== fromId && !isAdmin(user)) {
    return NextResponse.error()
  }
  const profile = await getProfileById(supabase, fromId)
  if (!profile) {
    return NextResponse.error()
  }
  const donor = await getProfileById(supabase, fromId)
  if (!donor) {
    return NextResponse.error()
  }
  const txns = await getTxnAndProjectsByUser(supabase, fromId)
  const bids = await getPendingBidsByUser(supabase, fromId)
  const userSpendableFunds = calculateCharityBalance(
    txns,
    bids,
    fromId,
    profile?.accreditation_status
  )
  if (!Number.isFinite(amount) || amount <= 0 || userSpendableFunds < amount) {
    console.error('not enough funds')
    return NextResponse.error()
  }
  // A person's donation to a grant project: the donate box's limits ($10 minimum, nothing past the funding goal).
  // Admins' manual transfers (admin page, "Create txn") are corrections and skip them.
  if (projectId && !isAdmin(user)) {
    const [project, projectTxns] = await Promise.all([
      getProjectAndBidsById(supabase, projectId),
      getTxnsByProject(supabase, projectId),
    ])
    // A person's project donation goes to the project's creator
    if (!project || project.creator !== toId) {
      return new Response('Recipient must be the project creator', { status: 400 })
    }
    if (project?.type === 'grant') {
      const raised = getAmountRaised(project, project.bids, projectTxns)
      const limitError = donationLimitError(amount, fundingLeft(project.funding_goal, raised))
      if (limitError) {
        return new Response(limitError, { status: 400 })
      }
    }
  }
  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.from('txns').insert({
    from_id: fromId,
    to_id: toId,
    amount: amount,
    token: 'USD',
    project: projectId ?? null,
    type: projectId ? 'project donation' : 'profile donation',
  })
  if (error) {
    console.error(error)
    return NextResponse.error()
  }
  if (projectId) {
    const project = await getProjectById(supabaseAdmin, projectId)
    const postmarkVars = {
      amount: amount,
      donorName: donor.full_name,
      projectTitle: project.title,
      projectUrl: `https://manifund.org/projects/${project.slug}`,
    }
    await sendTemplateEmail(TEMPLATE_IDS.PROJECT_DONATION, postmarkVars, toId)
    const { error } = await supabase.rpc('follow_project', {
      project_id: projectId,
      follower_id: donor.id,
    })
    if (error) {
      console.error(error)
      return NextResponse.error()
    }
  } else {
    const regranterProfile = await getProfileById(supabaseAdmin, toId)
    if (!regranterProfile) {
      return NextResponse.error()
    } else if (regranterProfile.type === 'individual') {
      const postmarkVars = {
        amount: amount,
        donorName: donor.full_name,
        profileUrl: `${getURL()}/${regranterProfile.username}`,
      }
      await sendTemplateEmail(TEMPLATE_IDS.REGRANTER_DONATION, postmarkVars, toId)
    }
  }

  if (error) {
    return NextResponse.error()
  } else {
    return NextResponse.json('success')
  }
}
