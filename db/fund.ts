import { SupabaseClient } from '@supabase/supabase-js'
import { MiniProfile, Profile } from '@/db/profile'
import { FullTxn, getFullTxnsByUser, getTxnAndProjectsByUser } from '@/db/txn'
import { getPendingBidsByUser } from '@/db/bid'
import { calculateCharityBalance } from '@/utils/math'

// A fund the viewer can give as, with what it has left to give.
export type GivingFund = { fund: Profile; balance: number }

export async function isFundAdmin(supabase: SupabaseClient, fundId: string, userId: string) {
  const { data, error } = await supabase
    .from('fund_admins')
    .select('fund_id, profiles!fund_admins_fund_id_fkey(type)')
    .eq('fund_id', fundId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) {
    throw error
  }
  return (data?.profiles as unknown as { type: string } | null)?.type === 'fund'
}

export async function getFundAdmins(supabase: SupabaseClient, fundId: string) {
  const { data, error } = await supabase
    .from('fund_admins')
    .select('profiles!fund_admins_profile_id_fkey(id, username, full_name, avatar_url, type)')
    .eq('fund_id', fundId)
    .order('created_at')
  if (error) {
    throw error
  }
  return data.map((row) => row.profiles as unknown as MiniProfile)
}

export async function getFundBalance(supabase: SupabaseClient, fund: Profile) {
  const [txns, bids] = await Promise.all([
    getTxnAndProjectsByUser(supabase, fund.id),
    getPendingBidsByUser(supabase, fund.id),
  ])
  return calculateCharityBalance(txns, bids, fund.id, fund.accreditation_status)
}

export async function getGivingFunds(
  supabase: SupabaseClient,
  userId: string
): Promise<GivingFund[]> {
  const { data, error } = await supabase
    .from('fund_admins')
    .select('profiles!fund_admins_fund_id_fkey(*)')
    .eq('profile_id', userId)
  if (error) {
    throw error
  }
  const funds = data
    .map((row) => row.profiles as unknown as Profile)
    .filter((fund) => fund.type === 'fund')
  return await Promise.all(
    funds.map(async (fund) => ({ fund, balance: await getFundBalance(supabase, fund) }))
  )
}

export type FundSummary = {
  fund: Profile
  admins: MiniProfile[]
  raised: number
  // granted plus pending offers (F4)
  recommended: number
  grantCount: number
  open: boolean
}

// Every fund, with its figures as its page counts them (F4), for /funds (F10).
export async function listFundSummaries(supabase: SupabaseClient): Promise<FundSummary[]> {
  const { data: funds } = await supabase
    .from('profiles')
    .select('*')
    .eq('type', 'fund')
    .order('created_at')
    .throwOnError()
  return await Promise.all(
    (funds as Profile[]).map(async (fund) => {
      const [admins, txns, bids, causes] = await Promise.all([
        getFundAdmins(supabase, fund.id),
        getFullTxnsByUser(supabase, fund.id),
        getPendingBidsByUser(supabase, fund.id),
        supabase.from('causes').select('open').eq('fund_id', fund.id).throwOnError(),
      ])
      const figures = fundFigures(fund.id, txns)
      return {
        fund,
        admins,
        raised: figures.raised,
        recommended:
          figures.granted +
          bids.filter((bid) => bid.type === 'donate').reduce((sum, bid) => sum + bid.amount, 0),
        grantCount: figures.grants.length,
        open: (causes.data ?? []).some((cause) => cause.open),
      }
    })
  )
}

// F4: raised is every dollar given to the fund, granted every dollar it has given out.
export function fundFigures(fundId: string, txns: FullTxn[]) {
  const usd = txns.filter((txn) => txn.token === 'USD' && txn.from_id !== txn.to_id)
  const raised = usd.filter((txn) => txn.to_id === fundId).reduce((sum, txn) => sum + txn.amount, 0)
  const grants = usd.filter(
    (txn) =>
      txn.from_id === fundId && (txn.type === 'project donation' || txn.type === 'profile donation')
  )
  const granted = grants.reduce((sum, txn) => sum + txn.amount, 0)
  return { raised, granted, grants }
}
