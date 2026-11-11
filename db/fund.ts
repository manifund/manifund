import { SupabaseClient } from '@supabase/supabase-js'
import { MiniProfile, Profile } from '@/db/profile'
import { getTxnAndProjectsByUser } from '@/db/txn'
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
