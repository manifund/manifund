import 'server-only'

import Link from 'next/link'
import clsx from 'clsx'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser, isAdmin } from '@/db/profile'
import { getAllResponses, getMyResponse, ResponseWithProfile } from '@/db/donor-survey'
import {
  CAPACITIES,
  GIVING_BANDS_2027,
  MAX_RATING,
  labelFor,
  parseCauseRatings,
} from '@/utils/donor-survey'
import { Avatar } from '@/components/avatar'
import { SectionHeading, SurveyShell } from '../survey-header'
import { SectionNav } from '../section-nav'
import { aggregate } from './aggregate'
import { BarList, CauseSpread, Figure, FundsScale } from './charts'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Donor survey results',
}

// Flip to true when the aggregate results go public. Until then only
// respondents and admins can see this page.
const RESULTS_ARE_PUBLIC = false

export default async function ResultsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  const admin = isAdmin(user)

  const mine = await getMyResponse(user)

  if (!RESULTS_ARE_PUBLIC && !admin && !mine) {
    return (
      <SurveyShell>
        <section className="flex flex-col gap-5">
          <h1 className="text-[32px] font-medium leading-[1.15] tracking-[-0.02em]">
            What other donors said
          </h1>
          <p className="text-[15px] leading-relaxed text-gray-500">
            Sorry, the results are only visible to people who have filled out the survey.
          </p>
          <Link
            href="/donor-survey"
            className="flex h-[46px] w-full max-w-[261px] items-center justify-center rounded-[10px] bg-orange-500 text-[15px] font-medium text-white transition-colors hover:bg-orange-600"
          >
            Take the survey
          </Link>
        </section>
      </SurveyShell>
    )
  }

  const responses = await getAllResponses()
  const agg = aggregate(responses)
  const published = responses.filter((r) => r.is_public && r.profiles?.username)
  const firstName = mine?.full_name.trim().split(' ')[0]

  const shareBits: string[] = []
  if (mine?.share_with_funders) shareBits.push('shared with other major funders')
  if (mine?.is_public) shareBits.push('published on your Manifund profile')
  const shareSummary = shareBits.length
    ? `Your answers will be ${shareBits.join(' and ')}. You can change this anytime.`
    : 'Your individual answers stay private — only you and the Manifund team can see them.'

  const myRatings = mine
    ? Object.fromEntries(parseCauseRatings(mine.cause_ratings).map((c) => [c.name, c.rating]))
    : undefined

  return (
    <SurveyShell>
      <SectionNav items={GROUPS} />
      <div className="flex flex-col gap-16">
        <section className="flex flex-col gap-3.5">
          {mine && (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          <h1 className="text-[32px] font-medium leading-[1.15] tracking-[-0.02em]">
            {firstName ? `Thanks, ${firstName}. ` : ''}Here’s what other donors said.
          </h1>
          <p className="text-[15px] leading-relaxed text-gray-500">
            Live tallies from {agg.n} {agg.n === 1 ? 'response' : 'responses'} so far. We’ll publish
            the full aggregate in a couple of weeks.
          </p>
          {mine && (
            <p className="flex items-center gap-2 text-[13px] text-gray-600">
              <span aria-hidden className="h-2.5 w-5 rounded bg-orange-500" />
              Your own answers are in dark orange.
            </p>
          )}
        </section>

        <Group id="giving" title="Giving">
          <Figure title="Total giving planned for 2026">
            <BarList bars={agg.giving2026} total={agg.n} highlight={mine?.giving_2026} />
          </Figure>
          <Figure title="And in 2027">
            <BarList bars={agg.giving2027} total={agg.n} highlight={mine?.giving_2027} />
          </Figure>
        </Group>

        <Group id="causes" title="Causes">
          <Figure
            title="Interest in each cause area"
            note={`Bars show how many people gave each rating; the number is the average, out of ${MAX_RATING}.`}
          >
            <CauseSpread causes={agg.causes} mine={myRatings} />
          </Figure>
        </Group>

        <Group id="how" title="How people give">
          <Figure
            title="Funds vs. picking charities yourself"
            note={agg.fundsMean === null ? 'Nobody has answered this one yet.' : undefined}
          >
            <FundsScale
              average={agg.fundsMean === null ? null : Math.round(agg.fundsMean)}
              mine={mine?.funds_vs_direct ?? null}
            />
          </Figure>
          <Figure
            title="Hours per month spent on donating"
            note={`${agg.hoursAnswered} of ${agg.n} answered this optional question.`}
          >
            <BarList bars={agg.hours} total={agg.hoursAnswered} highlight={mine?.hours_per_month} />
          </Figure>
          <Figure
            title="In what capacity people are giving"
            note="People could pick more than one."
          >
            <BarList bars={agg.capacity} total={agg.n} highlight={mine?.capacity} />
          </Figure>
        </Group>

        <Group id="touch" title="Staying in touch">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 text-sm">
            <Term>Want opportunities sent to them</Term>
            <Count n={agg.wantsOpportunities} total={agg.n} />
            {agg.frequency.map((f) => (
              <Row key={f.key} label={f.label} n={f.count} total={agg.wantsOpportunities} indent />
            ))}
            <Term>Want to come to fundraising events</Term>
            <Count n={agg.wantsEvents} total={agg.n} />
          </dl>
        </Group>

        <Group id="donors" title="Donors">
          <section className="flex flex-col gap-3.5">
            <h3 className="text-base font-medium text-gray-900">
              Donors who published their answers
            </h3>
            {published.length === 0 ? (
              <p className="text-sm text-gray-500">Nobody yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-100">
                {published.map((r) => (
                  <DonorRow key={r.id} response={r} href={`/${r.profiles!.username}/donor`} />
                ))}
              </ul>
            )}
          </section>

          {admin && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-baseline gap-3">
                <h3 className="text-base font-medium text-gray-900">All responses</h3>
                <span className="rounded-full bg-gray-100 px-2 py-[3px] text-xs text-gray-500">
                  Admins only
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-gray-100">
                {responses.map((r) => (
                  <DonorRow
                    key={r.id}
                    response={r}
                    href={`/donor-survey/responses/${r.id}`}
                    admin
                  />
                ))}
              </ul>
            </section>
          )}
        </Group>

        {mine && (
          <section className="flex flex-col gap-3 rounded-[14px] border border-gray-100 bg-[#fafafa] p-5">
            <span className="text-[15px] font-normal">What happens next</span>
            <ul className="flex list-disc flex-col pl-5 text-sm leading-[1.7] text-gray-600">
              <li>Aggregate results published in a couple of weeks — we’ll email you.</li>
              <li>{shareSummary}</li>
            </ul>
            <Link
              href="/donor-survey"
              className="mt-1 self-start rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-normal text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 hover:no-underline"
            >
              Edit my answers
            </Link>
          </section>
        )}
      </div>
    </SurveyShell>
  )
}

const GROUPS = [
  { id: 'giving', title: 'Giving' },
  { id: 'causes', title: 'Causes' },
  { id: 'how', title: 'How people give' },
  { id: 'touch', title: 'Staying in touch' },
  { id: 'donors', title: 'Donors' },
]

function Group(props: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={props.id} className="flex scroll-mt-8 flex-col gap-10">
      <SectionHeading title={props.title} />
      {props.children}
    </div>
  )
}

function Term(props: { children: React.ReactNode }) {
  return <dt className="text-gray-700">{props.children}</dt>
}

function Count(props: { n: number; total: number }) {
  const share = props.total ? Math.round((props.n / props.total) * 100) : 0
  return (
    <dd className="m-0 text-right tabular-nums">
      <span className="text-gray-900">{props.n}</span>
      <span className="ml-2 inline-block w-9 text-gray-500">{share}%</span>
    </dd>
  )
}

function Row(props: { label: string; n: number; total: number; indent?: boolean }) {
  return (
    <>
      <dt className={clsx('text-gray-500', props.indent && 'pl-4')}>{props.label}</dt>
      <Count n={props.n} total={props.total} />
    </>
  )
}

function DonorRow(props: { response: ResponseWithProfile; href: string; admin?: boolean }) {
  const { response: r, href, admin } = props
  const profile = r.profiles
  const capacity = (r.capacity ?? [])
    .map((c) => labelFor(CAPACITIES, c))
    .filter(Boolean)
    .join(', ')
  return (
    <li>
      <Link
        href={href}
        className="-mx-3 flex items-center gap-3.5 rounded-[10px] px-3 py-3 text-gray-900 transition-colors hover:bg-gray-50 hover:no-underline"
      >
        <Avatar
          username={profile?.username ?? ''}
          avatarUrl={profile?.avatar_url ?? null}
          id={r.profile_id ?? ''}
          size={9}
          noLink
        />
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-[15px] font-normal">
            {profile?.full_name || r.full_name}
          </span>
          <span className="truncate text-[13px] text-gray-500">
            {admin ? r.email : capacity}
            {r.org ? ` (${r.org})` : ''}
          </span>
        </span>
        <span className="hidden shrink-0 text-sm tabular-nums text-gray-500 sm:block">
          {labelFor(GIVING_BANDS_2027, r.giving_2026)}
        </span>
        {admin && (
          <span className="hidden shrink-0 gap-1.5 text-xs sm:flex">
            {r.is_public && <Tag>public</Tag>}
            {r.share_with_funders && <Tag>funders</Tag>}
            {!r.profile_id && <Tag muted>no account</Tag>}
          </span>
        )}
      </Link>
    </li>
  )
}

function Tag(props: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-[3px]',
        props.muted ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-700'
      )}
    >
      {props.children}
    </span>
  )
}
