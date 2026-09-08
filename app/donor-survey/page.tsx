import 'server-only'

import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getProfileByUsername, getUser } from '@/db/profile'
import {
  DonorSurveyResponse,
  getResponseByEmail,
  getResponseByProfileId,
  getResponseByToken,
} from '@/db/donor-survey'
import { EDIT_COOKIE, parseCauseAllocation } from '@/utils/donor-survey'
import { Avatar } from '@/components/avatar'
import { DonorSurveyForm, SignedInUser } from './donor-survey-form'
import type { DonorSurveyInput } from './actions'

export const metadata = {
  title: 'Donor survey',
}

export default async function DonorSurveyPage(props: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token: tokenFromUrl } = await props.searchParams
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)

  let signedIn: SignedInUser | null = null
  let existing: DonorSurveyResponse | null = null
  let token: string | null = null

  if (user) {
    const profile = await getProfileById(supabase, user.id)
    signedIn = {
      fullName: profile?.full_name || user.email || '',
      email: user.email ?? '',
      username: profile?.username ?? '',
    }
    existing =
      (await getResponseByProfileId(user.id)) ??
      (user.email ? await getResponseByEmail(user.email) : null)
  } else {
    const cookieStore = await cookies()
    token = tokenFromUrl || cookieStore.get(EDIT_COOKIE)?.value || null
    existing = await getResponseByToken(token)
    if (!existing) token = tokenFromUrl ?? null
  }

  const austin = await getProfileByUsername(supabase, 'Austin')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
      <Preface avatarUrl={austin?.avatar_url ?? null} />
      <div className="mt-20">
        <DonorSurveyForm
          initial={existing ? toInput(existing) : null}
          user={signedIn}
          token={token}
        />
      </div>
    </div>
  )
}

function Preface(props: { avatarUrl: string | null }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-josefin text-5xl font-semibold leading-none text-gray-900 sm:text-6xl">
        Donor survey
      </h1>
      <div className="flex flex-col gap-5 text-lg leading-relaxed text-gray-800">
        <p>
          Hey! Austin here, from Manifund. I want to help you figure out where to donate, but I also
          don’t want to be bugging you too often — I find it awkward to ask for money, and you’re
          probably drowning in funding requests. So instead: would you take 10 minutes to answer
          this survey?
        </p>
        <p>Also:</p>
        <ul className="flex list-disc flex-col gap-2 pl-6 marker:text-orange-500">
          <li>After filling it out, you’ll get to see what other donors answered!</li>
          <li>We’ll publish the aggregate results in a couple of weeks</li>
          <li>
            Optionally, you can publish your personal answers. Example:{' '}
            <a
              href="/Austin/donor"
              className="underline decoration-gray-300 underline-offset-4 hover:text-orange-600"
            >
              manifund.org/Austin/donor
            </a>
          </li>
        </ul>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {props.avatarUrl && (
          <Avatar avatarUrl={props.avatarUrl} username="Austin" id="" size={10} noLink />
        )}
        <span className="font-satisfy text-3xl text-gray-900">Austin</span>
      </div>
    </div>
  )
}

function toInput(r: DonorSurveyResponse): DonorSurveyInput {
  return {
    full_name: r.full_name,
    email: r.email,
    capacity: r.capacity ?? [],
    org: r.org ?? '',
    giving_2026: r.giving_2026 ?? '',
    giving_2027: r.giving_2027 ?? '',
    cause_allocation: parseCauseAllocation(r.cause_allocation),
    advice_sources: r.advice_sources ?? '',
    landscape_problems: r.landscape_problems ?? '',
    funds_vs_direct: r.funds_vs_direct,
    already_given: r.already_given ?? '',
    evaluation_approach: r.evaluation_approach ?? '',
    charities_interested: r.charities_interested ?? '',
    hours_per_month: r.hours_per_month ?? '',
    dream_setup: r.dream_setup ?? '',
    wants_opportunities: r.wants_opportunities,
    opportunity_frequency: r.opportunity_frequency ?? '',
    wants_call: r.wants_call,
    wants_events: r.wants_events,
    share_with_funders: r.share_with_funders,
    is_public: r.is_public,
    other_thoughts: r.other_thoughts ?? '',
    referrals: r.referrals ?? '',
  }
}
