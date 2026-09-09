import 'server-only'

import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import {
  DonorSurveyResponse,
  getResponseByEmail,
  getResponseByProfileId,
  getResponseByToken,
} from '@/db/donor-survey'
import { EDIT_COOKIE, parseCauseAllocation } from '@/utils/donor-survey'
import { DonorSurveyForm, SignedInUser } from './donor-survey-form'
import { SurveyShell } from './survey-header'
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

  return (
    <SurveyShell>
      <Preface />
      <DonorSurveyForm
        initial={existing ? toInput(existing) : null}
        user={signedIn}
        token={token}
      />
    </SurveyShell>
  )
}

function Preface() {
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-[36px] font-bold leading-[1.15] tracking-[-0.02em] text-gray-900 [text-wrap:pretty]">
        Donor survey
      </h1>
      <div className="flex flex-col gap-3 text-base leading-relaxed text-gray-700 [text-wrap:pretty]">
        <p>
          Hey! Austin here, from Manifund. I want to help you figure out where to donate, but I also
          don’t want to be bugging you too often — I find it awkward to ask for money, and you’re
          probably drowning in funding requests.
          <br />
          <br />
          So instead: would you take 10 minutes to answer this survey?
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>After filling it out, you’ll get to see what other donors answered</li>
          <li>We’ll publish the aggregate results in a couple of weeks</li>
          <li>
            Optionally, you can publish your personal answers. Example:{' '}
            <a
              href="/Austin/donor"
              target="_blank"
              rel="noreferrer"
              className="text-orange-600 hover:text-orange-700 hover:underline"
            >
              manifund.org/Austin/donor
            </a>
          </li>
        </ul>
      </div>
    </section>
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
    already_given_link: r.already_given_link ?? '',
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
