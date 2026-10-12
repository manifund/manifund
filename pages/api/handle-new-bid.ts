// Called by Supabase webhook trigger on bids table INSERT.
// If Vercel Attack Challenge Mode is on, this endpoint must be bypassed in Vercel Firewall rules,
// otherwise the webhook will be blocked by the security checkpoint.
import { NextApiRequest, NextApiResponse } from 'next'
import { getProjectAndProfileById, ProjectAndProfile, TOTAL_SHARES } from '@/db/project'
import { maybeActivateProject } from '@/utils/activate-project'
import { Bid } from '@/db/bid'
import { getShareholders } from '@/app/projects/[slug]/project-tabs'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/db/edge'
import { getTxnAndProjectsByUser, getTxnsByProject } from '@/db/txn'
import { getProfileById } from '@/db/profile'
import { getBidsByUser } from '@/db/bid'
import { calculateCashBalance, calculateCharityBalance, calculateShares } from '@/utils/math'
import { makeTrade, updateBidFromTrade } from '@/utils/trade'
import { isAuthorizedWebhook } from '@/utils/webhook-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorizedWebhook(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const bid = req.body.record as Bid
  const supabase = createAdminClient()
  const project = await getProjectAndProfileById(supabase, bid.project)
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  if (project.stage === 'proposal') {
    await maybeActivateProject(supabase, bid.project)
  } else if (project.type === 'cert') {
    await findAndMakeTrades(bid, supabase)
    if (bid.type === 'buy') {
      await sendShareholderEmails(bid, project, supabase)
    }
  }
  const { error } = await supabase.rpc('follow_project', {
    project_id: project.id,
    follower_id: bid.bidder,
  })
  if (error) {
    console.error(error)
    return res.status(500).json({ error: 'Error following project' })
  }
  return res.status(200).json({ bid })
}

async function sendShareholderEmails(
  bid: Bid,
  project: ProjectAndProfile,
  supabase: SupabaseClient
) {
  const txns = await getTxnsByProject(supabase, bid.project)
  const bidder = await getProfileById(supabase, bid.bidder)
  if (!bidder) {
    return
  }
  const shareholders = getShareholders(txns)
  for (const shareholder of shareholders) {
    await sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        notifText: genBidText(bidder.full_name, bid, project),
        buttonUrl: `manifund.org/projects/${project.slug}?tab=bids`,
        buttonText: 'See offer',
        subject: `New offer from ${bidder.full_name} on "${project.title}"`,
      },
      shareholder.profile.id
    )
  }
}

async function findAndMakeTrades(bid: Bid, supabase: SupabaseClient) {
  const newOfferType = bid.type
  const { data, error } = await supabase
    .from('bids')
    .select()
    .eq('project', bid.project)
    .order('valuation', { ascending: newOfferType === 'buy' })
  if (error) {
    throw error
  }
  const oldBids = data
    .filter((oldBid) => oldBid.bidder !== bid.bidder)
    .filter((oldBid) => oldBid.type !== newOfferType)
    .filter((oldBid) => oldBid.status === 'pending')
  let budget = bid.amount
  let newBidderAvailable = await deliverable(bid, supabase)
  for (const oldBid of oldBids) {
    if (
      (newOfferType === 'buy'
        ? oldBid.valuation > bid.valuation
        : oldBid.valuation < bid.valuation) ||
      budget <= 0 ||
      newBidderAvailable <= 0
    ) {
      return
    }
    const oldBidderAvailable = await deliverable(oldBid, supabase)
    const tradeAmount = Math.min(budget, oldBid.amount, newBidderAvailable, oldBidderAvailable)
    if (tradeAmount <= 0) continue
    budget -= tradeAmount
    newBidderAvailable -= tradeAmount
    await makeTrade(
      (tradeAmount / oldBid.valuation) * TOTAL_SHARES,
      tradeAmount,
      bid.project,
      oldBid.bidder,
      bid.bidder,
      newOfferType === 'buy',
      supabase
    )
    await updateBidFromTrade(oldBid, tradeAmount, supabase)
    await updateBidFromTrade(bid, tradeAmount, supabase)
  }
}

// What one side of a trade can deliver right now, in dollars: a seller, the value of the shares
// they hold at their offer's valuation; a buyer, their balance not counting this offer.
async function deliverable(bid: Bid, supabase: SupabaseClient) {
  const [profile, txns, bids] = await Promise.all([
    getProfileById(supabase, bid.bidder),
    getTxnAndProjectsByUser(supabase, bid.bidder),
    getBidsByUser(supabase, bid.bidder),
  ])
  if (bid.type === 'sell') {
    return (calculateShares(txns, bid.bidder, bid.project) / TOTAL_SHARES) * bid.valuation
  }
  const otherBids = bids.filter((other) => other.id !== bid.id)
  const accredited = !!profile?.accreditation_status
  return accredited
    ? calculateCashBalance(txns, otherBids, bid.bidder, accredited)
    : calculateCharityBalance(txns, otherBids, bid.bidder, accredited)
}

function genBidText(bidderName: string, bid: Bid, project: ProjectAndProfile) {
  return `${bidderName} has made a ${bid.type} offer for ${Math.round(
    (bid.amount / bid.valuation) * 100
  )}% equity at a valuation of $${bid.valuation} for the project "${project.title}" on Manifund.`
}
