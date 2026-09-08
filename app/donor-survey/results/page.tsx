import 'server-only'

import Link from 'next/link'
import { cookies } from 'next/headers'
import clsx from 'clsx'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser, isAdmin } from '@/db/profile'
import {
  getAllResponses,
  getResponseByEmail,
  getResponseByProfileId,
  getResponseByToken,
  ResponseWithProfile,
} from '@/db/donor-survey'
import { CAPACITIES, EDIT_COOKIE, GIVING_BANDS_2027, labelFor } from '@/utils/donor-survey'
import { Avatar } from '@/components/avatar'
import { buttonClass } from '@/components/button'
import { aggregate, formatCompactDollars } from './aggregate'
import { BarList, Figure, PctList, Stat } from './charts'

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

  let hasResponded = false
  if (user) {
    hasResponded =
      !!(await getResponseByProfileId(user.id)) ||
      !!(user.email && (await getResponseByEmail(user.email)))
  } else {
    const cookieStore = await cookies()
    hasResponded = !!(await getResponseByToken(cookieStore.get(EDIT_COOKIE)?.value))
  }

  if (!RESULTS_ARE_PUBLIC && !admin && !hasResponded) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-20">
        <h1 className="font-josefin text-4xl font-semibold text-gray-900">Donor survey results</h1>
        <p className="text-lg text-gray-700">
          Lorem ipsum: the results are only visible to people who have filled out the survey.
        </p>
        <Link href="/donor-survey" className={clsx(buttonClass('xl', 'gradient'), 'self-start')}>
          Take the survey
        </Link>
      </div>
    )
  }

  const responses = await getAllResponses()
  const agg = aggregate(responses)
  const published = responses.filter((r) => r.is_public && r.profiles?.username)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-20 px-4 py-12 sm:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="font-josefin text-5xl font-semibold leading-none text-gray-900 sm:text-6xl">
          Donor survey results
        </h1>
        <p className="text-lg text-gray-700">
          {agg.n} {agg.n === 1 ? 'donor has' : 'donors have'} answered so far.{' '}
          {hasResponded && (
            <Link
              href="/donor-survey"
              className="underline decoration-gray-300 underline-offset-4 hover:text-orange-600"
            >
              Change your answers
            </Link>
          )}
        </p>
      </header>

      <section className="grid gap-8 sm:grid-cols-3">
        <Stat value={agg.n} label="responses" />
        <Stat
          value={
            agg.combined2026.low === 0 && agg.combined2026.high === 0
              ? '—'
              : `${formatCompactDollars(agg.combined2026.low)}–${formatCompactDollars(agg.combined2026.high)}${agg.combined2026.openEnded ? '+' : ''}`
          }
          label="combined 2026 giving"
          sub="summing the low and high ends of each range"
        />
        <Stat
          value={agg.fundsMean === null ? '—' : `${Math.round(agg.fundsMean)}%`}
          label="to funds, on average"
          sub={agg.fundsAnswered ? `${agg.fundsAnswered} answered` : undefined}
        />
      </section>

      <section className="grid gap-12 sm:grid-cols-2">
        <Figure title="How much in total are you looking to give, in 2026?">
          <BarList bars={agg.giving2026} total={agg.n} />
        </Figure>
        <Figure title="In 2027?">
          <BarList bars={agg.giving2027} total={agg.n} />
        </Figure>
      </section>

      <Figure
        title="What cause areas are you interested in? in what proportion?"
        note={`Average share of each donor’s giving, across ${agg.causeRespondents} ${agg.causeRespondents === 1 ? 'donor' : 'donors'}. Causes people added themselves are in gray.`}
      >
        <PctList rows={agg.causes} />
      </Figure>

      <section className="grid gap-12 sm:grid-cols-2">
        <Figure
          title="Giving to funds vs selecting individual charities yourself"
          note="Share going to funds"
        >
          <BarList bars={agg.fundsVsDirect} total={agg.fundsAnswered} />
        </Figure>
        <Figure title="Hours per month spent on donating">
          <BarList bars={agg.hours} total={agg.hoursAnswered} />
        </Figure>
      </section>

      <section className="grid gap-12 sm:grid-cols-2">
        <Figure title="In what capacity are you giving?" note="People could pick more than one">
          <BarList bars={agg.capacity} total={agg.n} />
        </Figure>
        <Figure title="Comms">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm">
            <Term>want opportunities sent to them</Term>
            <Count n={agg.wantsOpportunities} total={agg.n} />
            {agg.frequency.map((f) => (
              <FragmentRow
                key={f.key}
                label={`  ${f.label}`}
                n={f.count}
                total={agg.wantsOpportunities}
                indent
              />
            ))}
            <Term>want a 1:1 call with the Manifund team</Term>
            <Count n={agg.wantsCall} total={agg.n} />
            <Term>want to come to fundraising events</Term>
            <Count n={agg.wantsEvents} total={agg.n} />
            <Term>will share answers with other major funders</Term>
            <Count n={agg.shareWithFunders} total={agg.n} />
            <Term>published their answers</Term>
            <Count n={agg.isPublic} total={agg.n} />
          </dl>
        </Figure>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="font-josefin text-3xl font-semibold text-gray-900">
          Donors who published their answers
        </h2>
        {published.length === 0 ? (
          <p className="text-gray-500">Nobody yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-200">
            {published.map((r) => (
              <DonorRow key={r.id} response={r} href={`/${r.profiles!.username}/donor`} />
            ))}
          </ul>
        )}
      </section>

      {admin && (
        <section className="flex flex-col gap-6">
          <h2 className="font-josefin text-3xl font-semibold text-gray-900">
            All responses
            <span className="ml-3 font-sans text-base font-normal text-gray-500">admins only</span>
          </h2>
          <ul className="flex flex-col divide-y divide-gray-200">
            {responses.map((r) => (
              <DonorRow key={r.id} response={r} href={`/donor-survey/responses/${r.id}`} admin />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Term(props: { children: React.ReactNode }) {
  return <dt className="text-gray-800">{props.children}</dt>
}

function Count(props: { n: number; total: number }) {
  const share = props.total ? Math.round((props.n / props.total) * 100) : 0
  return (
    <dd className="text-right tabular-nums">
      <span className="text-gray-900">{props.n}</span>
      <span className="ml-2 inline-block w-9 text-gray-400">{share}%</span>
    </dd>
  )
}

function FragmentRow(props: { label: string; n: number; total: number; indent?: boolean }) {
  return (
    <>
      <dt className={clsx('text-gray-500', props.indent && 'pl-4')}>{props.label.trim()}</dt>
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
        className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-white"
      >
        <Avatar
          username={profile?.username ?? ''}
          avatarUrl={profile?.avatar_url ?? null}
          id={r.profile_id ?? ''}
          size={10}
          noLink
        />
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-base font-medium text-gray-900">
            {profile?.full_name || r.full_name}
          </span>
          <span className="truncate text-sm text-gray-500">
            {admin ? r.email : capacity}
            {r.org ? ` (${r.org})` : ''}
          </span>
        </span>
        <span className="hidden shrink-0 text-sm tabular-nums text-gray-700 sm:block">
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
        'rounded px-1.5 py-0.5',
        props.muted ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'
      )}
    >
      {props.children}
    </span>
  )
}
