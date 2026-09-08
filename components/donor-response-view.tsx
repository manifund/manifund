import { ReactNode } from 'react'
import clsx from 'clsx'
import {
  CAPACITIES,
  FREQUENCIES,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  causeColor,
  labelFor,
  parseCauseAllocation,
} from '@/utils/donor-survey'
import type { PublicDonorSurveyResponse, DonorSurveyResponse } from '@/db/donor-survey'
import { Donut } from '@/app/donor-survey/cause-allocation'

// Read-only rendering of one donor's answers, in the same order as the form.
// `full` adds the fields only the owner and admins may see.

type AnyResponse = PublicDonorSurveyResponse | DonorSurveyResponse

export function DonorResponseView(props: { response: AnyResponse; full?: boolean }) {
  const { response: r, full } = props
  const priv = full ? (r as DonorSurveyResponse) : null
  const allocation = parseCauseAllocation(r.cause_allocation)
  const capacity = (r.capacity ?? []).map((c) => labelFor(CAPACITIES, c)).filter(Boolean)

  return (
    <div className="flex flex-col gap-16">
      <Group title="Basic questions">
        {priv && <Answer label="email">{priv.email}</Answer>}
        <Answer label="in what capacity are you giving?">
          {capacity.length ? capacity.join(', ') : null}
        </Answer>
        {r.org && <Answer label="for what org?">{r.org}</Answer>}
      </Group>

      <Group title="Giving questions">
        <div className="grid gap-8 sm:grid-cols-2">
          <Answer label="How much in total are you looking to give, in 2026?">
            <Big>{labelFor(GIVING_BANDS_2027, r.giving_2026)}</Big>
          </Answer>
          <Answer label="In 2027?">
            <Big>{labelFor(GIVING_BANDS_2027, r.giving_2027)}</Big>
          </Answer>
        </div>
        <Answer label="What cause areas are you interested in? in what proportion?">
          {allocation.length > 0 ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              <Donut allocation={allocation} size={160} className="mx-auto sm:mx-0" />
              <ul className="flex grow flex-col gap-1.5">
                {allocation
                  .map((c, i) => ({ ...c, i }))
                  .filter((c) => c.pct > 0)
                  .sort((a, b) => b.pct - a.pct)
                  .map((c) => (
                    <li key={c.i} className="flex items-center gap-3 text-base">
                      <span
                        aria-hidden
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: causeColor(c.i) }}
                      />
                      <span className="grow text-gray-800">{c.name}</span>
                      <span className="tabular-nums text-gray-600">{c.pct}%</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </Answer>
        <Answer label="Where do you currently go for advice about effective giving?">
          {r.advice_sources}
        </Answer>
        <Answer label="What are your biggest problems with the current giving landscape?">
          {r.landscape_problems}
        </Answer>
      </Group>

      <Group title="More giving questions">
        <Answer label="how are you thinking about giving to funds (like Longview and CG) vs selecting individual charities yourself?">
          {r.funds_vs_direct !== null ? <FundsBar value={r.funds_vs_direct} /> : null}
        </Answer>
        <Answer label="Where have you already given? (how much?)">{r.already_given}</Answer>
        <Answer label="How do you evaluate funds? How do you evaluate charities?">
          {r.evaluation_approach}
        </Answer>
        <Answer label="What are some charities you might like to give to?">
          {r.charities_interested}
        </Answer>
        <Answer label="How many hours per month would you ideally spend on donating your money?">
          {r.hours_per_month ? <Big>{labelFor(HOURS_BANDS, r.hours_per_month)}</Big> : null}
        </Answer>
        <Answer label="What would your dream setup for donating your money look like?">
          {r.dream_setup}
        </Answer>
      </Group>

      {priv && (
        <Group title="Comms questions">
          <Answer label="Would you like me to send you opportunities I think you would like?">
            {priv.wants_opportunities === null
              ? null
              : priv.wants_opportunities
                ? `yes${priv.opportunity_frequency ? `, ${labelFor(FREQUENCIES, priv.opportunity_frequency)}` : ''}`
                : 'no'}
          </Answer>
          <Answer label="Would you like to:">
            <Checks
              items={[
                ['meet for 1:1 call with a member of Manifund team?', priv.wants_call],
                ['come to events centered on fundraising for top charities?', priv.wants_events],
              ]}
            />
          </Answer>
          <Answer label="Would you be willing to share your personal answers:">
            <Checks
              items={[
                [
                  'With other major funders (such as CG, Longview, Macroscopic, AISTOF)',
                  priv.share_with_funders,
                ],
                ['On your public Manifund profile?', priv.is_public],
              ]}
            />
          </Answer>
        </Group>
      )}

      <Group title="Misc">
        <Answer label="Other thoughts on effective giving?">{r.other_thoughts}</Answer>
        {priv && <Answer label="Who else should take this survey?">{priv.referrals}</Answer>}
      </Group>
    </div>
  )
}

function Group(props: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="font-josefin text-2xl font-semibold text-gray-900">{props.title}</h2>
      {props.children}
    </section>
  )
}

function Answer(props: { label: string; children: ReactNode }) {
  const empty = props.children === null || props.children === undefined || props.children === ''
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-snug text-gray-500">{props.label}</p>
      {empty ? (
        <p className="text-base text-gray-300">—</p>
      ) : typeof props.children === 'string' ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">
          {props.children}
        </p>
      ) : (
        props.children
      )}
    </div>
  )
}

function Big(props: { children: ReactNode }) {
  return (
    <p className="font-josefin text-3xl font-semibold tabular-nums text-gray-900">
      {props.children}
    </p>
  )
}

function Checks(props: { items: [string, boolean][] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {props.items.map(([label, on]) => (
        <li
          key={label}
          className={clsx(
            'flex items-center gap-2 text-base',
            on ? 'text-gray-900' : 'text-gray-400'
          )}
        >
          <span
            aria-hidden
            className={clsx(
              'flex h-4 w-4 items-center justify-center rounded border',
              on ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
            )}
          >
            {on && (
              <svg viewBox="0 0 20 20" className="h-3 w-3 fill-none stroke-white stroke-[3]">
                <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
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

export function FundsBar(props: { value: number }) {
  const { value } = props
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-orange-500" style={{ width: `${value}%` }} />
        <div className="h-full w-0.5 bg-white" />
        <div className="h-full grow bg-gray-300" />
      </div>
      <div className="flex justify-between text-sm text-gray-700">
        <span>
          <span className="font-medium text-gray-900">{value}%</span> funds
        </span>
        <span>
          <span className="font-medium text-gray-900">{100 - value}%</span> individual charities
        </span>
      </div>
    </div>
  )
}
