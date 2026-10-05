import 'server-only'

import Link from 'next/link'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileByUsername, getUser, isAdmin } from '@/db/profile'
import { getResponseByProfileId } from '@/db/donor-survey'
import { DonorResponseView } from '@/components/donor-response-view'
import { DonorPageHeader } from '@/components/donor-page-header'
import NotFound from '@/app/not-found'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { params: Promise<{ usernameSlug: string }> }) {
  const { usernameSlug } = await props.params
  const profile = await getProfileByUsername(await createServerSupabaseClient(), usernameSlug)
  return { title: `${profile?.full_name || usernameSlug} as a donor` }
}

// A donor's published survey answers. Only the donor and admins can see it
// before the donor opts in; everyone else gets the site's not-found page.
// It sits in the app shell, so it uses the site's page padding, left-aligned,
// with a reading width for the answers.
export default async function DonorPage(props: { params: Promise<{ usernameSlug: string }> }) {
  const { usernameSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const [profile, user] = await Promise.all([
    getProfileByUsername(supabase, usernameSlug),
    getUser(supabase),
  ])
  if (!profile) return <NotFound />

  const response = await getResponseByProfileId(profile.id)
  const isOwner = user?.id === profile.id
  const canSeePrivate = isOwner || isAdmin(user)
  if (!response || (!response.is_public && !canSeePrivate)) return <NotFound />

  return (
    <div className="w-full max-w-2xl p-3 sm:p-5">
      <DonorPageHeader profile={profile} response={response} />
      {!response.is_public && (
        <p className="mt-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-gray-800">
          Not public yet. Only {isOwner ? 'you' : 'the donor'} and Manifund admins can see this
          page.{' '}
          {isOwner && (
            <Link href="/donor-survey" className="underline underline-offset-2">
              Change that in the survey.
            </Link>
          )}
        </p>
      )}
      <div className="mt-12">
        <DonorResponseView response={response} full={canSeePrivate} admin={isAdmin(user)} />
      </div>
    </div>
  )
}
