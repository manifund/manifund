import { getProfileById } from '@/db/profile'
import { NextRequest, NextResponse } from 'next/server'
import { getTxnAndProjectsByUser, getTxnsByUser } from '@/db/txn'
import { getUserAndClient } from '@/db/edge'
import {
  calculateAMMPorfolio,
  calculateBuyShares,
  calculateSellPayout,
  calculateTradeForValuation,
  calculateValuationAfterTrade,
  getTradeErrorMessage,
} from '@/utils/amm'
import {
  calculateCashBalance,
  calculateCharityBalance,
  calculateSellableShares,
} from '@/utils/math'
import { Bid, getBidsByUser } from '@/db/bid'
import { getProjectById, TOTAL_SHARES } from '@/db/project'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { makeTrade, genTradeText, updateBidFromTrade } from '@/utils/trade'
export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

type TradeWithAmmProps = {
  projectId: string
  amount: number // USD for buying, shares for selling
  buying: boolean
  valuation?: number
}

export default async function handler(req: NextRequest) {
  const { projectId, amount, buying, valuation } = (await req.json()) as TradeWithAmmProps
  const { supabase, user } = await getUserAndClient(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    (valuation !== undefined && (!Number.isFinite(valuation) || valuation <= 0))
  ) {
    return new Response('Invalid amount', { status: 400 })
  }
  const ammTxns = await getTxnsByUser(supabase, projectId)
  const [ammShares, ammUSD] = calculateAMMPorfolio(ammTxns, projectId)
  const numDollars = buying
    ? amount
    : !!valuation
      ? (amount / TOTAL_SHARES) * valuation
      : calculateSellPayout(amount, ammShares, ammUSD)
  const numShares = buying
    ? !!valuation
      ? (amount / valuation) * TOTAL_SHARES
      : calculateBuyShares(amount, ammShares, ammUSD)
    : amount
  const userTxns = await getTxnAndProjectsByUser(supabase, user.id)
  const userBids = await getBidsByUser(supabase, user.id)
  const userProfile = await getProfileById(supabase, user.id)
  const project = await getProjectById(supabase, projectId)
  const userSpendableFunds =
    user.id === project.creator
      ? calculateCashBalance(
          userTxns,
          userBids,
          user.id,
          userProfile?.accreditation_status ?? false
        )
      : calculateCharityBalance(
          userTxns,
          userBids,
          user.id,
          userProfile?.accreditation_status ?? false
        )
  const userSellableShares = calculateSellableShares(userTxns, userBids, projectId, user.id)
  const errorMessage = getTradeErrorMessage(
    buying ? 'buy' : 'sell',
    ammShares,
    ammUSD,
    userSpendableFunds,
    userSellableShares,
    !!valuation,
    valuation,
    numDollars,
    numShares / TOTAL_SHARES
  )
  if (errorMessage) {
    console.error(errorMessage)
    return new Response(errorMessage, { status: 400 })
  }
  if (valuation) {
    const bid = {
      amount: numDollars,
      bidder: user.id,
      project: projectId,
      valuation,
      type: buying ? 'buy' : 'sell',
      status: 'pending',
    } as Bid
    const { error } = await supabase.from('bids').insert([bid])
    if (error) {
      console.error(error)
      return new Response('Error', { status: 500 })
    }
  } else {
    let amountRemaining = amount
    while (amountRemaining > 0) {
      const { data: mostEligibleBid } = await supabase
        .from('bids')
        .select('*, profiles(username)')
        .eq('project', projectId)
        .eq('status', 'pending')
        .eq('type', buying ? 'sell' : 'buy')
        .order('valuation', { ascending: buying })
        .single()
      const ammTxns = await getTxnsByUser(supabase, projectId)
      const [ammShares, ammUSD] = calculateAMMPorfolio(ammTxns, projectId)
      const valuationAfterTrade = calculateValuationAfterTrade(amount, ammShares, ammUSD, buying)
      const hitsLimitOrder =
        !!mostEligibleBid &&
        (buying
          ? mostEligibleBid.valuation < valuationAfterTrade
          : mostEligibleBid.valuation > valuationAfterTrade)
      if (hitsLimitOrder) {
        const valuationAtLo = mostEligibleBid.valuation
        const [sharesInAmmTrade, usdInAmmTrade] = calculateTradeForValuation(
          ammShares,
          ammUSD,
          valuationAtLo
        )
        if (!!sharesInAmmTrade && !!usdInAmmTrade) {
          await makeTrade(
            Math.abs(sharesInAmmTrade),
            Math.abs(usdInAmmTrade),
            projectId,
            projectId,
            user.id,
            buying,
            supabase
          )
        }
        amountRemaining -= buying ? Math.abs(usdInAmmTrade) : Math.abs(sharesInAmmTrade)
        const usdInUserTrade = Math.min(
          mostEligibleBid.amount,
          buying ? amountRemaining : (amountRemaining / TOTAL_SHARES) * valuationAtLo
        )
        const sharesInUserTrade = Math.min(
          (mostEligibleBid.amount / valuationAtLo) * TOTAL_SHARES,
          buying ? (amountRemaining / valuationAtLo) * TOTAL_SHARES : amountRemaining
        )
        await makeTrade(
          sharesInUserTrade,
          usdInUserTrade,
          projectId,
          mostEligibleBid.bidder,
          user.id,
          buying,
          supabase
        )
        await updateBidFromTrade(mostEligibleBid, usdInUserTrade, supabase)
        await sendTemplateEmail(
          TEMPLATE_IDS.TRADE_ACCEPTED,
          {
            tradeText: genTradeText(mostEligibleBid, project.title, usdInUserTrade),
            recipientProfileUrl: `manifund.org/${mostEligibleBid.profiles?.username}`,
            bidType: buying ? 'sell' : 'buy',
            projectTitle: project.title,
          },
          mostEligibleBid.bidder
        )
        amountRemaining -= buying ? usdInUserTrade : sharesInUserTrade
      } else {
        await makeTrade(numShares, numDollars, projectId, projectId, user.id, buying, supabase)
        amountRemaining = 0
      }
    }
    const { error } = await supabase.rpc('follow_project', {
      project_id: projectId,
      follower_id: user.id,
    })
    if (error) {
      console.error(error)
      return NextResponse.error()
    }
  }
  return NextResponse.json('success')
}
