import 'server-only'

import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import { DonorSurveyResponse, getMyResponse } from '@/db/donor-survey'
import { DonorSurveyInput, EMPTY_SURVEY, parseCauseAllocation } from '@/utils/donor-survey'
import { DonorSurveyForm, SignedInUser } from './donor-survey-form'
import { SurveyShell } from './survey-header'

export const metadata = {
  title: 'Donor survey',
}

export default async function DonorSurveyPage(props: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token: tokenFromUrl } = await props.searchParams
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)

  const profile = user ? await getProfileById(supabase, user.id) : null
  const signedIn: SignedInUser | null = user
    ? {
        fullName: profile?.full_name || user.email || '',
        email: user.email ?? '',
        username: profile?.username ?? '',
        avatarUrl: profile?.avatar_url ?? null,
      }
    : null
  const existing = await getMyResponse(user, tokenFromUrl)
  // Saving falls back to the cookie on its own, so only a token from the
  // emailed link needs passing through.
  const token = user ? null : (tokenFromUrl ?? null)

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
      <h1 className="text-[36px] font-medium leading-[1.15] tracking-[-0.02em] text-gray-900 [text-wrap:pretty]">
        Donor survey
      </h1>
      <div className="flex flex-col gap-3 text-base font-light leading-relaxed text-gray-700 [text-wrap:pretty]">
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
  const input: Record<string, unknown> = { ...EMPTY_SURVEY }
  for (const key of Object.keys(EMPTY_SURVEY) as (keyof DonorSurveyInput)[]) {
    if (r[key] !== null) input[key] = r[key]
  }
  return {
    ...(input as DonorSurveyInput),
    cause_allocation: parseCauseAllocation(r.cause_allocation),
  }
}
