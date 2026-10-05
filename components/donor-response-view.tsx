import { ReactNode } from 'react'
import clsx from 'clsx'
import {
  FREQUENCIES,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  fundsLabel,
  labelFor,
  parseCauseRatings,
} from '@/utils/donor-survey'
import type { PublicDonorSurveyResponse, DonorSurveyResponse } from '@/db/donor-survey'
import { RatingDots } from '@/app/donor-survey/cause-ratings'
import { SectionHeading } from '@/app/donor-survey/survey-header'
import { FundsScale } from '@/app/donor-survey/results/charts'

// Read-only rendering of one donor's answers, in the same order and with the
// same section headings as the form. `full` adds the fields only the owner and
// admins may see, and shows unanswered questions; `admin` adds the contact
// choices only admins act on (1:1 call, sharing).

type AnyResponse = PublicDonorSurveyResponse | DonorSurveyResponse

export function DonorResponseView(props: {
  response: AnyResponse
  full?: boolean
  admin?: boolean
}) {
  const { response: r, full, admin } = props
  const priv = full ? (r as DonorSurveyResponse) : null
  const causes = parseCauseRatings(r.cause_ratings).sort((a, b) => b.rating - a.rating)
  const link = 'already_given_link' in r ? r.already_given_link : null

  // Each group is a list of [label, answer]. Visitors see only what the donor
  // answered; the donor and admins also see the gaps, as "—". Capacity, org
  // and the 2026 amount are in the page header already.
  const groups: [string, Item[]][] = [
    ['About', priv ? [['Email', priv.email]] : []],
    [
      'Giving',
      [
        [
          null,
          r.giving_2026 || r.giving_2027 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <Answer label="Planned for 2026">
                <Big>{labelFor(GIVING_BANDS_2027, r.giving_2026)}</Big>
              </Answer>
              <Answer label="And in 2027">
                <Big>{labelFor(GIVING_BANDS_2027, r.giving_2027)}</Big>
              </Answer>
            </div>
          ) : null,
        ],
        [
          'Interest in each cause area',
          causes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {causes.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-[15px] text-gray-900 [overflow-wrap:anywhere]">
                    {c.name}
                  </span>
                  <RatingDots rating={c.rating} />
                </li>
              ))}
            </ul>
          ) : null,
        ],
        ['Where they go for advice about effective giving', r.advice_sources],
        ['Biggest problems with the current giving landscape', r.landscape_problems],
      ],
    ],
    [
      'Going deeper',
      [
        [
          'Funds vs. picking charities themself',
          r.funds_vs_direct !== null ? (
            <FundsScale
              average={null}
              mine={r.funds_vs_direct}
              mineLabel={fundsLabel(r.funds_vs_direct)}
            />
          ) : null,
        ],
        [
          'Where they have already given',
          r.already_given || link ? (
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
          ) : null,
        ],
        ['How they evaluate funds and charities', r.evaluation_approach],
        ['Charities they might like to give to', r.charities_interested],
        [
          'Hours per month they’d ideally spend on donating',
          r.hours_per_month ? <Big>{labelFor(HOURS_BANDS, r.hours_per_month)}</Big> : null,
        ],
        ['Dream setup for donating', r.dream_setup],
      ],
    ],
    [
      'Staying in touch',
      priv
        ? [
            [
              'Wants opportunities sent to them',
              priv.wants_opportunities === null
                ? null
                : priv.wants_opportunities
                  ? `Yes${priv.opportunity_frequency ? `, ${labelFor(FREQUENCIES, priv.opportunity_frequency)?.toLowerCase()}` : ''}`
                  : 'No',
            ],
            [
              'Would like to',
              <Checks
                key="like"
                items={[
                  ...(admin
                    ? [
                        [
                          'Meet for a 1:1 call with a member of the Manifund team',
                          priv.wants_call,
                        ] as [string, boolean],
                      ]
                    : []),
                  ['Come to events centered on fundraising for top charities', priv.wants_events],
                ]}
              />,
            ],
            ...(admin
              ? [
                  [
                    'Willing to share their answers',
                    <Checks
                      key="share"
                      items={[
                        ['With other major funders', priv.share_with_funders],
                        ['On their public Manifund profile', priv.is_public],
                      ]}
                    />,
                  ] as Item,
                ]
              : []),
          ]
        : [],
    ],
    [
      'Wrapping up',
      [
        ['Other thoughts on effective giving', r.other_thoughts],
        ...(priv ? [['Who else should take this survey', priv.referrals] as Item] : []),
      ],
    ],
  ]

  return (
    <div className="flex flex-col gap-12">
      {groups.map(([title, items]) => {
        const shown = full ? items : items.filter(([, value]) => !isEmpty(value))
        if (shown.length === 0) return null
        return (
          <section key={title} className="flex flex-col gap-6">
            <SectionHeading title={title} />
            {shown.map(([label, value], i) =>
              label === null ? (
                <div key={i}>{value}</div>
              ) : (
                <Answer key={label} label={label}>
                  {value}
                </Answer>
              )
            )}
          </section>
        )
      })}
    </div>
  )
}

// A null label means the value lays out its own labels.
type Item = [string | null, ReactNode]

const isEmpty = (v: ReactNode) => v === null || v === undefined || v === ''

function Answer(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-gray-500">{props.label}</span>
      {isEmpty(props.children) ? (
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
