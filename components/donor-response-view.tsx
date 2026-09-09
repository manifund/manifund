import { ReactNode } from 'react'
import clsx from 'clsx'
import {
  CAPACITIES,
  FREQUENCIES,
  FUNDS_LABELS,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  causeColor,
  labelFor,
  parseCauseAllocation,
} from '@/utils/donor-survey'
import type { PublicDonorSurveyResponse, DonorSurveyResponse } from '@/db/donor-survey'
import { CauseLegend, ProportionBar } from '@/app/donor-survey/cause-allocation'

// Read-only rendering of one donor's answers, in the same order and style as
// the form. `full` adds the fields only the owner and admins may see.

type AnyResponse = PublicDonorSurveyResponse | DonorSurveyResponse

export function DonorResponseView(props: { response: AnyResponse; full?: boolean }) {
  const { response: r, full } = props
  const priv = full ? (r as DonorSurveyResponse) : null
  const allocation = parseCauseAllocation(r.cause_allocation)
  const segments = allocation.map((c, i) => ({ ...c, color: causeColor(i) }))
  const capacity = (r.capacity ?? []).map((c) => labelFor(CAPACITIES, c)).filter(Boolean)
  const link = 'already_given_link' in r ? r.already_given_link : null

  return (
    <div className="flex flex-col gap-12">
      <Group title="About">
        {priv && <Answer label="Email">{priv.email}</Answer>}
        <Answer label="Giving capacity">{capacity.length ? capacity.join(', ') : null}</Answer>
        {r.org && <Answer label="Org">{r.org}</Answer>}
      </Group>

      <Group title="Giving">
        <div className="grid gap-6 sm:grid-cols-2">
          <Answer label="Planned for 2026">
            <Big>{labelFor(GIVING_BANDS_2027, r.giving_2026)}</Big>
          </Answer>
          <Answer label="And in 2027">
            <Big>{labelFor(GIVING_BANDS_2027, r.giving_2027)}</Big>
          </Answer>
        </div>
        <Answer label="Cause areas, by proportion">
          {allocation.length > 0 ? (
            <div className="flex flex-col gap-3">
              <ProportionBar segments={segments} />
              <CauseLegend segments={segments.filter((s) => s.pct > 0)} />
            </div>
          ) : null}
        </Answer>
        <Answer label="Where they go for advice about effective giving">{r.advice_sources}</Answer>
        <Answer label="Biggest problems with the current giving landscape">
          {r.landscape_problems}
        </Answer>
      </Group>

      <Group title="Going deeper">
        <Answer label="Funds vs. picking charities themself">
          {r.funds_vs_direct !== null ? (
            <span className="self-start rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-normal text-orange-700">
              {FUNDS_LABELS[r.funds_vs_direct] ?? `${r.funds_vs_direct}%`}
            </span>
          ) : null}
        </Answer>
        <Answer label="Where they have already given">
          {r.already_given || link ? (
            <div className="flex flex-col gap-1.5">
              {r.already_given && <Text>{r.already_given}</Text>}
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="break-all text-sm text-orange-600 hover:underline"
                >
                  {link}
                </a>
              )}
            </div>
          ) : null}
        </Answer>
        <Answer label="How they evaluate funds and charities">{r.evaluation_approach}</Answer>
        <Answer label="Charities they might like to give to">{r.charities_interested}</Answer>
        <Answer label="Hours per month they’d ideally spend on donating">
          {r.hours_per_month ? <Big>{labelFor(HOURS_BANDS, r.hours_per_month)}</Big> : null}
        </Answer>
        <Answer label="Dream setup for donating">{r.dream_setup}</Answer>
      </Group>

      {priv && (
        <Group title="Staying in touch">
          <Answer label="Wants opportunities sent to them">
            {priv.wants_opportunities === null
              ? null
              : priv.wants_opportunities
                ? `Yes${priv.opportunity_frequency ? `, ${labelFor(FREQUENCIES, priv.opportunity_frequency)?.toLowerCase()}` : ''}`
                : 'No'}
          </Answer>
          <Answer label="Would like to">
            <Checks
              items={[
                ['Meet for a 1:1 call with a member of the Manifund team', priv.wants_call],
                ['Come to events centered on fundraising for top charities', priv.wants_events],
              ]}
            />
          </Answer>
          <Answer label="Willing to share their answers">
            <Checks
              items={[
                ['With other major funders', priv.share_with_funders],
                ['On their public Manifund profile', priv.is_public],
              ]}
            />
          </Answer>
        </Group>
      )}

      <Group title="Wrapping up">
        <Answer label="Other thoughts on effective giving">{r.other_thoughts}</Answer>
        {priv && <Answer label="Who else should take this survey">{priv.referrals}</Answer>}
      </Group>
    </div>
  )
}

function Group(props: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="border-b border-gray-100 pb-3 text-[22px] font-medium tracking-[-0.01em] text-gray-900">
        {props.title}
      </h2>
      {props.children}
    </section>
  )
}

function Answer(props: { label: string; children: ReactNode }) {
  const empty = props.children === null || props.children === undefined || props.children === ''
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-gray-500">{props.label}</span>
      {empty ? (
        <span className="text-[15px] text-gray-300">—</span>
      ) : typeof props.children === 'string' ? (
        <Text>{props.children}</Text>
      ) : (
        props.children
      )}
    </div>
  )
}

function Text(props: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-900">
      {props.children}
    </p>
  )
}

function Big(props: { children: ReactNode }) {
  return <p className="text-2xl font-medium tabular-nums text-gray-900">{props.children}</p>
}

function Checks(props: { items: [string, boolean][] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {props.items.map(([label, on]) => (
        <li
          key={label}
          className={clsx(
            'flex items-center gap-2 text-[15px]',
            on ? 'text-gray-900' : 'text-gray-400'
          )}
        >
          <span
            aria-hidden
            className={clsx(
              'grid h-4 w-4 place-items-center rounded border-[1.5px]',
              on ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
            )}
          >
            {on && (
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-white stroke-2">
                <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="sr-only">{on ? 'yes' : 'no'}:</span>
          {label}
        </li>
      ))}
    </ul>
  )
}
