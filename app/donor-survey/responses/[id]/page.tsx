import 'server-only'

import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser, isAdmin } from '@/db/profile'
import { getResponseById } from '@/db/donor-survey'
import { DonorResponseView } from '@/components/donor-response-view'
import { DonorPageHeader } from '@/components/donor-page-header'
import NotFound from '@/app/not-found'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// One response by id, for admins and the respondent. Exists because email-only
// respondents have no username, so no /<username>/donor page.
export default async function ResponsePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!UUID_RE.test(id)) return <NotFound />
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  const response = await getResponseById(id)
  if (!response) return <NotFound />
  const isOwner = !!user && response.profile_id === user.id
  if (!isOwner && !isAdmin(user)) return <NotFound />

  const profile = response.profile_id
    ? await getProfileById(supabase, response.profile_id)
    : undefined

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
      <DonorPageHeader profile={profile ?? null} response={response} />
      <div className="mt-16">
        <DonorResponseView response={response} full />
      </div>
    </div>
  )
}
