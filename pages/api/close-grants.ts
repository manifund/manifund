import { differenceInDays, isBefore } from 'date-fns'
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/utils/cron-auth'
import { createAdminClient } from '@/db/edge'
import { getAmountRaised, getMinIncludingAmm } from '@/utils/math'
import { Project } from '@/db/project'
import { Bid } from '@/db/bid'
import { SupabaseClient } from '@supabase/supabase-js'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { isProd } from '@/db/env'
import { Cause, getPrizeCause } from '@/db/cause'
import { checkReactivateEligible } from '@/utils/activate-project'
import { resolveAuction } from '@/utils/resolve-auction'
import { uniq } from 'es-toolkit'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export default async function handler(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isProd()) {
    return NextResponse.json('not prod')
  }
  const supabase = createAdminClient()
  const { data: proposals, error } = await supabase
    .from('projects')
    .select(
      '*, bids(*), profiles!projects_creator_fkey(full_name), causes(slug), project_follows(follower_id)'
    )
    .eq('stage', 'proposal')
  if (error) {
    console.error(error)
    return NextResponse.json('error')
  }
  const now = new Date()
  const proposalsPastDeadline = proposals?.filter((project) => {
    const closeDate = new Date(`${project.auction_close}T23:59:59-07:00`)
    const timeSinceDeadline = differenceInDays(now, closeDate)
    return (
      timeSinceDeadline >= 0 &&
      // Only send notifs once per week
      timeSinceDeadline % 7 === 0
    )
  })
  for (const project of proposalsPastDeadline ?? []) {
    const prizeCause = await getPrizeCause(
      project.causes.map((c) => c.slug),
      supabase
    )
    await closeProject(
      project,
      project.bids,
      project.project_follows.map((f) => f.follower_id),
      project.profiles?.full_name ?? '',
      supabase,
      prizeCause
    )
  }
  return NextResponse.json('closed grants')
}

async function closeProject(
  project: Project,
  bids: Bid[],
  followerIds: string[],
  creatorName: string,
  supabase: SupabaseClient,
  prizeCause?: Cause
) {
  const amountRaised = getAmountRaised(project, bids)
  const minIncludingAmm = getMinIncludingAmm(project)
  const activeAuction = !!prizeCause?.cert_params?.auction && project.stage === 'proposal'
  if (amountRaised >= minIncludingAmm) {
    if (!project.alerts_paused) {
      if (!project.signed_agreement) {
        await sendTemplateEmail(
          TEMPLATE_IDS.GENERIC_NOTIF,
          {
            notifText: `Your project "${project.title}" has enough funding to proceed but is awaiting your signature on the grant agreement. Please sign the agreement to activate your grant.`,
            buttonUrl: `https://manifund.org/projects/${project.slug}/agreement`,
            buttonText: 'Sign agreement',
            subject: 'Manifund: Reminder to sign your grant agreement',
          },
          project.creator
        )
      }
      // Nothing for an admin to act on until the creator has signed.
      if (!project.approved && project.signed_agreement) {
        await sendTemplateEmail(
          TEMPLATE_IDS.GENERIC_NOTIF,
          {
            notifText: `The project "${project.title}" has enough funding but is awaiting admin approval.`,
            buttonUrl: `https://manifund.org/projects/${project.slug}`,
            buttonText: 'See project',
            subject: 'Manifund: Reminder to approve project',
          },
          undefined,
          'austin@manifund.org'
        )
      }
    }
    if (project.approved && project.signed_agreement && activeAuction) {
      await resolveAuction(project)
    }
  } else {
    if (activeAuction) {
      await resolveAuction(project)
    } else {
      const { error } = await supabase.rpc('reject_proposal', {
        project_id: project.id,
      })
      if (error) {
        console.error(error)
        return
      }
      const reactivateEligible = checkReactivateEligible(project, prizeCause)
      const creatorPostmarkVars = {
        recipientFullName: creatorName,
        verdictMessage: `We regret to inform you that your project, "${
          project.title
        }," has not been funded. It received $${amountRaised} in funding offers but had a minimum funding goal of $${
          project.min_funding
        }. ${
          reactivateEligible
            ? "You can activate your project from your project page if you'd like your project to stay eligible for trading and retroactive funding, though you will still not receive any upfront funding."
            : ''
        } Thank you for posting your project, and please let us know on our discord if you have any questions or feedback about the process.`,
        projectUrl: `https://manifund.org/projects/${project.slug}`,
        subject: `Manifund project not funded: "${project.title}"`,
        adminName: 'Manifund team',
      }
      await sendTemplateEmail(TEMPLATE_IDS.VERDICT, creatorPostmarkVars, project.creator)
      const bidders = bids.map((bid) => bid.bidder)
      const uniqueBidders = uniq(bidders)
      uniqueBidders.forEach(async (bidder) => {
        const bidderPostmarkVars = {
          projectTitle: project.title,
          result: 'declined',
          projectUrl: `https://manifund.org/projects/${project.slug}`,
          auctionResolutionText: `This project was not funded, because it received only $${amountRaised} in funding, which is less than its minimum funding goal of $${project.min_funding}.`,
          bidResolutionText: `Your offer was declined.`,
        }
        await sendTemplateEmail(TEMPLATE_IDS.OFFER_RESOLVED, bidderPostmarkVars, bidder)
      })
    }
    // TODO: notify followers when project gets funded through auction
    const unnotifiedFollowers = followerIds.filter(
      (id) => id !== project.creator && !bids.find((bid) => bid.bidder === id)
    )
    for (const followerId of unnotifiedFollowers) {
      await sendTemplateEmail(
        TEMPLATE_IDS.GENERIC_NOTIF,
        {
          notifText: `This project was not funded, because it received only $${amountRaised} in funding, which is less than its' minimum funding goal of $${project.min_funding}.`,
          buttonUrl: `https://manifund.org/projects/${project.slug}`,
          buttonText: 'See project',
          subject: `Manifund: ${project.title} was not funded`,
        },
        followerId
      )
    }
  }
}
