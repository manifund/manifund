import { Bid, getBidsByUser } from '@/db/bid'
import { NextRequest } from 'next/server'
import uuid from 'react-uuid'
import { getUserAndClient } from '@/db/edge'
import { getProjectAndBidsById } from '@/db/project'
import { getProfileAndBidsById } from '@/db/profile'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { calculateCashBalance, calculateCharityBalance } from '@/utils/math'
import { calcFundingNeeded, calcTotalOffered } from '@/utils/activate-project'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

type BidProps = {
  projectId: string
  valuation: number
  amount: number
  type: Bid['type']
}

export default async function handler(req: NextRequest) {
  const { projectId, valuation, amount, type } = (await req.json()) as BidProps
  const { supabase, user } = await getUserAndClient(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(valuation) || valuation < 0) {
    return new Response('Invalid amount', { status: 400 })
  }
  const [bidder, txns, bids, project] = await Promise.all([
    getProfileAndBidsById(supabase, user.id),
    getTxnAndProjectsByUser(supabase, user.id),
    getBidsByUser(supabase, user.id),
    getProjectAndBidsById(supabase, projectId),
  ])
  const bidderBalance =
    bidder.accreditation_status && type === 'buy'
      ? calculateCashBalance(txns, bids, bidder.id, bidder.accreditation_status)
      : calculateCharityBalance(txns, bids, bidder.id, bidder.accreditation_status)
  if (type !== 'sell' && bidderBalance < amount) {
    return new Response('Insufficient funds', { status: 401 })
  }
  if (!project) {
    return new Response('Project not found', { status: 404 })
  }
  // Round bids up slightly to fully fund projects if close (floating point errors)
  let actualBidAmount = amount
  if (project.stage === 'proposal' && type === 'assurance buy') {
    const totalOffered = calcTotalOffered(project) + amount
    const totalNeeded = calcFundingNeeded(project)
    const difference = totalNeeded - totalOffered
    if (difference < 0 && difference > -1 && amount - difference <= bidderBalance) {
      actualBidAmount = totalNeeded - totalOffered
    }
  }
  const id = uuid()
  const newBid = {
    id,
    project: projectId,
    bidder: user.id,
    valuation,
    amount: actualBidAmount,
    status: 'pending' as Bid['status'],
    type,
  }
  await supabase.from('bids').insert([newBid]).throwOnError()
}
