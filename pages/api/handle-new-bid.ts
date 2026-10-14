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
    await findAndMakeTrades(bid, project.creator, supabase)
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

async function findAndMakeTrades(bid: Bid, projectCreator: string, supabase: SupabaseClient) {
  // Only buy and sell offers trade with each other.
  if ((bid.type !== 'buy' && bid.type !== 'sell') || bid.status !== 'pending') {
    return
  }
  const newOfferType = bid.type
  const counterType = newOfferType === 'buy' ? 'sell' : 'buy'
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
    .filter((oldBid) => oldBid.type === counterType)
    .filter((oldBid) => oldBid.status === 'pending')
  let budget = bid.amount
  let newBidderHoldings = await getHoldings(bid, projectCreator, supabase)
  for (const oldBid of oldBids) {
    if (
      (newOfferType === 'buy'
        ? oldBid.valuation > bid.valuation
        : oldBid.valuation < bid.valuation) ||
      budget <= 0 ||
      newBidderHoldings <= 0
    ) {
      return
    }
    // Trades happen at the existing offer's valuation.
    const price = oldBid.valuation
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }
    const oldBidderHoldings = await getHoldings(oldBid, projectCreator, supabase)
    const tradeAmount = Math.min(
      budget,
      oldBid.amount,
      holdingsInDollars(bid, newBidderHoldings, price),
      holdingsInDollars(oldBid, oldBidderHoldings, price)
    )
    if (!(tradeAmount > 0)) {
      continue
    }
    const numShares = (tradeAmount / price) * TOTAL_SHARES
    await makeTrade(
      numShares,
      tradeAmount,
      bid.project,
      oldBid.bidder,
      bid.bidder,
      newOfferType === 'buy',
      supabase
    )
    await updateBidFromTrade(oldBid, tradeAmount, supabase)
    await updateBidFromTrade({ ...bid, amount: budget }, tradeAmount, supabase)
    budget -= tradeAmount
    newBidderHoldings -= newOfferType === 'sell' ? numShares : tradeAmount
  }
}

// What one side of a trade holds right now: a seller, their shares in the project; a buyer, the
// balance a trade on this project draws from (cash for the project's creator, the charity balance
// for everyone else), minus their other pending offers.
async function getHoldings(bid: Bid, projectCreator: string, supabase: SupabaseClient) {
  if (bid.type === 'sell') {
    const txns = await getTxnAndProjectsByUser(supabase, bid.bidder)
    return calculateShares(txns, bid.bidder, bid.project)
  }
  const [profile, txns, bids] = await Promise.all([
    getProfileById(supabase, bid.bidder),
    getTxnAndProjectsByUser(supabase, bid.bidder),
    getBidsByUser(supabase, bid.bidder),
  ])
  const otherBids = bids.filter((other) => other.id !== bid.id)
  const accredited = !!profile?.accreditation_status
  return bid.bidder === projectCreator
    ? calculateCashBalance(txns, otherBids, bid.bidder, accredited)
    : calculateCharityBalance(txns, otherBids, bid.bidder, accredited)
}

function holdingsInDollars(bid: Bid, holdings: number, price: number) {
  return bid.type === 'sell' ? (holdings / TOTAL_SHARES) * price : holdings
}

function genBidText(bidderName: string, bid: Bid, project: ProjectAndProfile) {
  return `${bidderName} has made a ${bid.type} offer for ${Math.round(
    (bid.amount / bid.valuation) * 100
  )}% equity at a valuation of $${bid.valuation} for the project "${project.title}" on Manifund.`
}
