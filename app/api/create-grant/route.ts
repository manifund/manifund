import { NextResponse } from 'next/server'
import uuid from 'react-uuid'
import type { JSONContent } from '@tiptap/core'
import { getProfileById, getProfileByUsername } from '@/db/profile'
import { Project, TOTAL_SHARES } from '@/db/project'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getURL } from '@/utils/constants'
import { projectSlugify } from '@/utils/formatting'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { calculateCharityBalance } from '@/utils/math'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { invalidateProjectsCache } from '@/db/project-cached'
import { getBidsByUser } from '@/db/bid'
import { updateProjectCauses } from '@/db/cause'
import { triggerProjectScoring } from '@/app/utils/trigger-scoring'
import { post } from '@/lib/comments'
import { log } from '@/lib/log'

// Moved from pages/api (Edge) to App Router (Node) in the comments POC, so that the rationale is
// posted through lib/comments, whose notifications are sent after the response.
export const runtime = 'nodejs'

type GrantProps = {
  title: string
  subtitle: string
  description: JSONContent
  donorNotes: JSONContent
  donorContribution: number
  fundingGoal: number
  minFunding: number
  recipientEmail?: string
  recipientName?: string
  recipientUsername?: string
  causeSlugs: string[]
  locationDescription: string
  lobbying: boolean
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: Request) {
  const {
    title,
    subtitle,
    description,
    donorNotes,
    donorContribution,
    fundingGoal,
    minFunding,
    recipientEmail,
    recipientName,
    recipientUsername,
    causeSlugs,
    locationDescription,
    lobbying,
  } = (await req.json()) as GrantProps
  const supabase = await createServerSupabaseClient()
  const {
    data: { user: regranter },
  } = await supabase.auth.getUser()
  if (!regranter) return fail('sign in first', 401)
  const regranterProfile = await getProfileById(supabase, regranter.id)
  if (
    (recipientEmail && recipientUsername) ||
    ((!recipientEmail || !recipientName) && !recipientUsername) ||
    !regranterProfile
  ) {
    return fail('invalid inputs')
  }
  const regranterTxns = await getTxnAndProjectsByUser(supabase, regranter.id)
  const regranterBids = await getBidsByUser(supabase, regranter.id)
  const regranterCharityBalance = calculateCharityBalance(
    regranterTxns,
    regranterBids,
    regranterProfile.id,
    regranterProfile.accreditation_status
  )
  if (regranterCharityBalance < donorContribution) return fail('insufficient funds')
  const slug = await projectSlugify(title, supabase)
  const recipientProfile = recipientUsername
    ? await getProfileByUsername(supabase, recipientUsername)
    : null
  if (!recipientProfile && recipientUsername) return fail('recipient not found', 404)
  const project = {
    id: uuid(),
    creator: recipientProfile ? recipientProfile.id : regranter.id,
    title,
    blurb: subtitle,
    description,
    min_funding: minFunding,
    funding_goal: fundingGoal,
    founder_shares: TOTAL_SHARES,
    type: 'grant' as Project['type'],
    stage: 'proposal' as Project['stage'],
    round: 'Regrants',
    slug,
    approved: null,
    signed_agreement: false,
    location_description: locationDescription,
    lobbying,
  }
  // The money and the project: one transaction (SQL function). The rationale follows below.
  if (recipientEmail && recipientName) {
    await supabase
      .rpc('create_transfer_grant_v2', {
        project,
        project_transfer: {
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          project_id: project.id,
        },
        grant_amount: donorContribution,
      })
      .throwOnError()
    await sendTemplateEmail(
      TEMPLATE_IDS.NEW_USER_GRANT,
      {
        amount: donorContribution,
        regranterName: regranterProfile.full_name,
        projectTitle: title,
        loginUrl: `${getURL()}login?email=${recipientEmail}`,
      },
      undefined,
      recipientEmail
    )
  } else if (recipientProfile) {
    await supabase
      .rpc('give_grant_v2', {
        project,
        donation: { project: project.id, amount: donorContribution, bidder: regranter.id },
      })
      .throwOnError()
    await sendTemplateEmail(
      TEMPLATE_IDS.EXISTING_USER_GRANT,
      {
        amount: donorContribution,
        regranterName: regranterProfile.full_name,
        projectTitle: title,
        projectUrl: `${getURL()}projects/${slug}`,
      },
      recipientProfile.id
    )
  } else {
    return fail('invalid inputs')
  }

  // The regrantor's reasoning, as a 'grant rationale' comment. If it can't be saved, the grant
  // still stands and the regrantor is asked to post it again (decided 2026-09-28).
  let rationaleError: string | undefined
  const rationale = await post(
    regranterProfile,
    { target: { project: project.id }, content: donorNotes, type: 'grant rationale' },
    'server'
  )
  if (!rationale.ok) {
    rationaleError = `The grant was created, but its rationale wasn't saved (${rationale.message}). Please post it as a comment on the project.`
    log.error('grant.rationale_failed', { project_id: project.id, error: rationale.message })
  }

  await updateProjectCauses(supabase, causeSlugs, project.id)
  invalidateProjectsCache()
  await triggerProjectScoring(project.id)
  return NextResponse.json({ ...project, rationaleError })
}
