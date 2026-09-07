import { Database } from '@/db/database.types'
import { SupabaseClient } from '@supabase/supabase-js'

export type WithdrawalRequest = Database['public']['Tables']['withdrawal_requests']['Row']

// 'needs_manual' counts as open: the balance is reserved and the grantee
// can't stack another request.
export const OPEN_STATUSES = [
  'awaiting_recipient',
  'ready_to_pay',
  'pending_approval',
  'needs_manual',
] as const

export async function getWithdrawalRequestsByUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('profile_id', userId)
    .order('requested_at', { ascending: false })
    .throwOnError()
  return (data ?? []) as WithdrawalRequest[]
}

export async function getOpenWithdrawalRequest(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('profile_id', userId)
    .in('status', OPEN_STATUSES as unknown as string[])
    .maybeSingle()
    .throwOnError()
  return (data ?? null) as WithdrawalRequest | null
}

// The method a returning grantee's Mercury recipient was onboarded with. That
// recipient only holds routing details for the one method, so reuse it rather
// than asking again -- and rather than trusting the client, which could send a
// destination the recipient can't accept. Null when we can't tell (e.g. a
// recipient created outside this flow), in which case we do ask.
export async function getKnownPaymentMethod(
  supabase: SupabaseClient,
  profileId: string,
  recipientId: string
) {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('payment_method')
    .eq('profile_id', profileId)
    .eq('mercury_recipient_id', recipientId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError()
  const method = data?.payment_method
  return method === 'ach' || method === 'internationalWire' ? method : null
}

export async function getOpenWithdrawalRequests(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .in('status', OPEN_STATUSES as unknown as string[])
    .order('requested_at', { ascending: true })
    .throwOnError()
  return (data ?? []) as WithdrawalRequest[]
}
