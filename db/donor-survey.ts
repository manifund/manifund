import 'server-only'

import { createAdminClient } from '@/db/supabase-admin'
import { Database } from '@/db/database.types'
import { hashSigningToken } from '@/utils/signing-token'

export type DonorSurveyResponse = Database['public']['Tables']['donor_survey_responses']['Row']
export type DonorSurveyInsert = Database['public']['Tables']['donor_survey_responses']['Insert']

// Columns a published donor page (manifund.org/<username>/donor) may show.
// Email, referrals (often other people's contact details), comms preferences,
// and the token hash never leave the server for anyone but the owner or admins.
export const PUBLIC_COLUMNS =
  'id, profile_id, full_name, capacity, org, giving_2026, giving_2027, cause_allocation, advice_sources, landscape_problems, funds_vs_direct, already_given, evaluation_approach, charities_interested, hours_per_month, dream_setup, other_thoughts, is_public, created_at, updated_at'

export type PublicDonorSurveyResponse = Pick<
  DonorSurveyResponse,
  | 'id'
  | 'profile_id'
  | 'full_name'
  | 'capacity'
  | 'org'
  | 'giving_2026'
  | 'giving_2027'
  | 'cause_allocation'
  | 'advice_sources'
  | 'landscape_problems'
  | 'funds_vs_direct'
  | 'already_given'
  | 'evaluation_approach'
  | 'charities_interested'
  | 'hours_per_month'
  | 'dream_setup'
  | 'other_thoughts'
  | 'is_public'
  | 'created_at'
  | 'updated_at'
>

export async function getResponseByProfileId(profileId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donor_survey_responses')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
    .throwOnError()
  return data
}

export async function getResponseByEmail(email: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donor_survey_responses')
    .select('*')
    .ilike('email', email.trim())
    .maybeSingle()
    .throwOnError()
  return data
}

export async function getResponseByToken(token: string | undefined | null) {
  if (!token) return null
  const hash = await hashSigningToken(token)
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donor_survey_responses')
    .select('*')
    .eq('edit_token_hash', hash)
    .maybeSingle()
    .throwOnError()
  return data
}

export async function getResponseById(id: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donor_survey_responses')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .throwOnError()
  return data
}

export async function getAllResponses() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donor_survey_responses')
    .select('*, profiles(username, full_name, avatar_url)')
    .order('created_at', { ascending: true })
    .throwOnError()
  return data ?? []
}

export type ResponseWithProfile = Awaited<ReturnType<typeof getAllResponses>>[number]

export async function getPublicResponses() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donor_survey_responses')
    .select(`${PUBLIC_COLUMNS}, profiles!inner(username, full_name, avatar_url)`)
    .eq('is_public', true)
    .order('created_at', { ascending: true })
    .throwOnError()
  return data ?? []
}
