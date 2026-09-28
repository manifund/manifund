import 'server-only'

import { cookies } from 'next/headers'
import { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/db/supabase-admin'
import { Database } from '@/db/database.types'
import { hashSigningToken } from '@/utils/signing-token'
import { EDIT_COOKIE } from '@/utils/donor-survey'

export type DonorSurveyResponse = Database['public']['Tables']['donor_survey_responses']['Row']
export type DonorSurveyInsert = Database['public']['Tables']['donor_survey_responses']['Insert']

// Columns a published donor page (manifund.org/<username>/donor) may show.
// Email, referrals (often other people's contact details), comms preferences,
// and the token hash are only for the owner and admins.
export type PublicDonorSurveyResponse = Pick<
  DonorSurveyResponse,
  | 'id'
  | 'profile_id'
  | 'full_name'
  | 'capacity'
  | 'org'
  | 'giving_2026'
  | 'giving_2027'
  | 'cause_ratings'
  | 'advice_sources'
  | 'landscape_problems'
  | 'funds_vs_direct'
  | 'already_given'
  | 'already_given_link'
  | 'evaluation_approach'
  | 'charities_interested'
  | 'hours_per_month'
  | 'dream_setup'
  | 'other_thoughts'
  | 'is_public'
  | 'created_at'
  | 'updated_at'
>

async function findResponse(
  column: 'id' | 'profile_id' | 'email' | 'edit_token_hash',
  value: string
) {
  const query = createAdminClient().from('donor_survey_responses').select('*')
  const { data } = await (
    column === 'email' ? query.ilike('email', value.trim()) : query.eq(column, value)
  )
    .maybeSingle()
    .throwOnError()
  return data
}

export const getResponseById = (id: string) => findResponse('id', id)
export const getResponseByProfileId = (profileId: string) => findResponse('profile_id', profileId)
export const getResponseByEmail = (email: string) => findResponse('email', email)

export async function getResponseByToken(token: string | undefined | null) {
  if (!token) return null
  return findResponse('edit_token_hash', await hashSigningToken(token))
}

// The viewer's own response: by account (profile, then email) when signed in,
// otherwise by the edit token from the emailed link or the cookie.
export async function getMyResponse(user: User | null, tokenFromUrl?: string) {
  if (user) {
    return (
      (await getResponseByProfileId(user.id)) ??
      (user.email ? await getResponseByEmail(user.email) : null)
    )
  }
  const cookieStore = await cookies()
  return getResponseByToken(tokenFromUrl || cookieStore.get(EDIT_COOKIE)?.value)
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
