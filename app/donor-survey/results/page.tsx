import 'server-only'

import Link from 'next/link'
import { cookies } from 'next/headers'
import clsx from 'clsx'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser, isAdmin } from '@/db/profile'
import {
  DonorSurveyResponse,
  getAllResponses,
  getResponseByEmail,
  getResponseByProfileId,
  getResponseByToken,
  ResponseWithProfile,
} from '@/db/donor-survey'
import { CAPACITIES, EDIT_COOKIE, GIVING_BANDS_2027, labelFor } from '@/utils/donor-survey'
import { Avatar } from '@/components/avatar'
import { CauseLegend, ProportionBar } from '../cause-allocation'
import { SurveyShell } from '../survey-header'
import { aggregate } from './aggregate'
import { BarList, Figure, FundsScale } from './charts'

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

  let mine: DonorSurveyResponse | null = null
  if (user) {
    mine =
      (await getResponseByProfileId(user.id)) ??
      (user.email ? await getResponseByEmail(user.email) : null)
  } else {
    const cookieStore = await cookies()
    mine = await getResponseByToken(cookieStore.get(EDIT_COOKIE)?.value)
  }

  if (!RESULTS_ARE_PUBLIC && !admin && !mine) {
    return (
      <SurveyShell>
        <section className="flex flex-col gap-5">
          <h1 className="text-[32px] font-medium leading-[1.15] tracking-[-0.02em]">
            What other donors said
          </h1>
          <p className="text-[15px] leading-relaxed text-gray-500">
            Lorem ipsum: the results are only visible to people who have filled out the survey.
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

  return (
    <SurveyShell>
      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-3.5">
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
          <h1 className="text-[32px] font-medium leading-[1.15] tracking-[-0.02em]">
            {firstName ? `Thanks, ${firstName}. ` : ''}Here’s what other donors said.
          </h1>
          <p className="text-[15px] leading-relaxed text-gray-500">
            Live tallies from {agg.n} {agg.n === 1 ? 'response' : 'responses'} so far. We’ll publish
            the full aggregate in a couple of weeks.
          </p>
        </section>

        <Figure
          title="Total giving planned for 2026"
          note={mine ? 'Your answer highlighted.' : undefined}
        >
          <BarList bars={agg.giving2026} total={agg.n} highlight={mine?.giving_2026 ?? null} />
        </Figure>

        <Figure title="Average cause-area allocation">
          <ProportionBar
            segments={agg.causes.map((c) => ({ name: c.name, pct: c.pct, color: c.color }))}
          />
          <CauseLegend
            segments={agg.causes.map((c) => ({ name: c.name, pct: c.pct, color: c.color }))}
          />
        </Figure>

        <Figure
          title="Funds vs. picking charities yourself"
          note={
            agg.fundsMean === null
              ? 'Nobody has answered this one yet.'
              : `Circle = average (${Math.round(agg.fundsMean)}%).${mine?.funds_vs_direct != null ? ' Line = you.' : ''}`
          }
        >
          <FundsScale
            average={agg.fundsMean === null ? null : Math.round(agg.fundsMean)}
            mine={mine?.funds_vs_direct ?? null}
          />
        </Figure>

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

        <Figure title="And in 2027" note={mine ? 'Your answer highlighted.' : undefined}>
          <BarList bars={agg.giving2027} total={agg.n} highlight={mine?.giving_2027 ?? null} />
        </Figure>

        <Figure
          title="Hours per month spent on donating"
          note={agg.hoursAnswered ? `${agg.hoursAnswered} answered.` : undefined}
        >
          <BarList
            bars={agg.hours}
            total={agg.hoursAnswered}
            highlight={mine?.hours_per_month ?? null}
          />
        </Figure>

        <Figure title="In what capacity people are giving" note="People could pick more than one.">
          <BarList bars={agg.capacity} total={agg.n} labelWidth="215px" />
        </Figure>

        <Figure title="Staying in touch">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 text-sm">
            <Term>Want opportunities sent to them</Term>
            <Count n={agg.wantsOpportunities} total={agg.n} />
            {agg.frequency.map((f) => (
              <Row key={f.key} label={f.label} n={f.count} total={agg.wantsOpportunities} indent />
            ))}
            <Term>Want a 1:1 call with the Manifund team</Term>
            <Count n={agg.wantsCall} total={agg.n} />
            <Term>Want to come to fundraising events</Term>
            <Count n={agg.wantsEvents} total={agg.n} />
            <Term>Will share answers with other major funders</Term>
            <Count n={agg.shareWithFunders} total={agg.n} />
            <Term>Published their answers</Term>
            <Count n={agg.isPublic} total={agg.n} />
          </dl>
        </Figure>

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
                <DonorRow key={r.id} response={r} href={`/donor-survey/responses/${r.id}`} admin />
              ))}
            </ul>
          </section>
        )}
      </div>
    </SurveyShell>
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
      <span className="ml-2 inline-block w-9 text-gray-400">{share}%</span>
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
          <span className="flex shrink-0 gap-1.5 text-xs">
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
