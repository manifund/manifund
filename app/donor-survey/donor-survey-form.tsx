'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useSupabase } from '@/db/supabase-provider'
import { Avatar } from '@/components/avatar'
import {
  CAPACITIES,
  DEFAULT_CAUSE_ALLOCATION,
  FREQUENCIES,
  FUNDS_LABELS,
  GIVING_BANDS,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  normalizeAllocation,
} from '@/utils/donor-survey'
import { saveDonorSurvey, type DonorSurveyInput, type SaveResult } from './actions'
import { CauseSliders, type CauseValue } from './cause-allocation'
import { CheckCard, Pills, Q, Section, TextArea, TextInput } from './fields'

export type SignedInUser = {
  fullName: string
  email: string
  username: string
  avatarUrl: string | null
}

const YES_NO = [
  { key: 'yes', label: 'Yes' },
  { key: 'no', label: 'No' },
] as const

const EMAIL_RE = /.+@.+\..+/

export function DonorSurveyForm(props: {
  initial: DonorSurveyInput | null
  user: SignedInUser | null
  token: string | null
}) {
  const { user, token } = props
  const router = useRouter()
  const { supabase } = useSupabase()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SaveResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const isEditing = props.initial !== null
  const [optionalOpen, setOptionalOpen] = useState(isEditing)
  const [causes, setCauses] = useState<CauseValue[]>(() =>
    (props.initial?.cause_allocation.length
      ? props.initial.cause_allocation
      : DEFAULT_CAUSE_ALLOCATION
    ).map((c) => ({ name: c.name, value: c.pct }))
  )
  const [fundsTouched, setFundsTouched] = useState(props.initial?.funds_vs_direct != null)
  const [form, setForm] = useState<DonorSurveyInput>(
    () =>
      props.initial ?? {
        full_name: user?.fullName ?? '',
        email: user?.email ?? '',
        capacity: [],
        org: '',
        giving_2026: '',
        giving_2027: '',
        cause_allocation: DEFAULT_CAUSE_ALLOCATION,
        advice_sources: '',
        landscape_problems: '',
        funds_vs_direct: null,
        already_given: '',
        already_given_link: '',
        evaluation_approach: '',
        charities_interested: '',
        hours_per_month: '',
        dream_setup: '',
        wants_opportunities: null,
        opportunity_frequency: '',
        wants_call: false,
        wants_events: false,
        share_with_funders: false,
        is_public: false,
        other_thoughts: '',
        referrals: '',
      }
  )
  const set = <K extends keyof DonorSurveyInput>(key: K, value: DonorSurveyInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setShowErrors(false)
  }

  const idOk = !!user || (form.full_name.trim() !== '' && EMAIL_RE.test(form.email))
  const filled = (v: string) => v.trim() !== ''
  const sections: SectionProgress[] = [
    { id: 'about', title: 'About you', done: count(idOk, form.capacity.length > 0), of: 2 },
    {
      id: 'giving',
      title: 'Your giving',
      done: count(
        !!form.giving_2026,
        !!form.giving_2027,
        filled(form.advice_sources),
        filled(form.landscape_problems)
      ),
      of: 4,
    },
    {
      id: 'deeper',
      title: 'Going deeper',
      done: count(
        fundsTouched,
        filled(form.already_given) || filled(form.already_given_link),
        filled(form.evaluation_approach),
        filled(form.charities_interested),
        !!form.hours_per_month,
        filled(form.dream_setup)
      ),
      of: 6,
      optional: true,
    },
    {
      id: 'touch',
      title: 'Staying in touch',
      done: count(form.wants_opportunities !== null),
      of: 1,
    },
    {
      id: 'last',
      title: 'Last two',
      done: count(filled(form.other_thoughts), filled(form.referrals)),
      of: 2,
      optional: true,
    },
  ]
  const missing: string[] = []
  if (!idOk) missing.push('your name and email (or sign in)')
  if (form.capacity.length === 0) missing.push('giving capacity')
  if (!form.giving_2026) missing.push('2026 amount')
  if (!form.giving_2027) missing.push('2027 amount')

  const fundsPct = form.funds_vs_direct ?? 50
  const givesForOrg = form.capacity.some((c) => c !== 'own_money')
  const serverError = result?.type === 'error' ? result.text : null

  const submit = () => {
    if (missing.length > 0) {
      setShowErrors(true)
      return
    }
    setResult(null)
    startTransition(async () => {
      const res = await saveDonorSurvey(
        {
          ...form,
          cause_allocation: normalizeAllocation(causes),
          funds_vs_direct: fundsTouched ? fundsPct : null,
        },
        token
      )
      setResult(res)
      if (res.type === 'saved') router.push('/donor-survey/results')
    })
  }

  if (result?.type === 'existing') {
    return (
      <div className="flex flex-col gap-2 rounded-[12px] border border-orange-200 bg-orange-50 px-4 py-4">
        <p className="text-[15px] font-normal text-gray-900">
          There are already answers under {result.email}.
        </p>
        <p className="text-sm text-gray-600">
          We just emailed a link to that address. Open it to change your answers.
        </p>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-14"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <ProgressBar sections={sections} />

      <Section id="about" title="About you">
        {user ? (
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-orange-200 bg-orange-50 px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              {user.avatarUrl ? (
                <Avatar username={user.username} avatarUrl={user.avatarUrl} id="" size={7} noLink />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-[13px] font-medium text-white">
                  {(user.fullName || user.email).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-normal text-gray-900">
                  Signed in as {user.fullName}
                </span>
                <span className="text-xs text-gray-500">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              className="px-2 py-1.5 text-[13px] font-normal text-orange-600 hover:text-orange-700"
              onClick={async () => {
                await supabase.auth.signOut()
                router.refresh()
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <Link
              href="/login?next=/donor-survey"
              className="flex h-[46px] w-full max-w-[261px] items-center justify-center rounded-[10px] bg-orange-500 text-[15px] font-medium text-white transition-colors hover:bg-orange-600"
            >
              Sign in with Manifund
            </Link>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              or
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-normal text-gray-900">Full name</span>
                <TextInput
                  value={form.full_name}
                  onChange={(v) => set('full_name', v)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  name="name"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-normal text-gray-900">Email</span>
                <TextInput
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  placeholder="ada@example.com"
                  type="email"
                  autoComplete="email"
                  name="email"
                />
                {EMAIL_RE.test(form.email) && (
                  <span className="text-xs text-gray-500">
                    If this matches a Manifund account, we’ll link your answers to it.
                  </span>
                )}
              </label>
            </div>
          </div>
        )}

        <Q label="In what capacity are you giving?">
          <div className="flex flex-col gap-2">
            {CAPACITIES.map((o) => (
              <CheckCard
                key={o.key}
                label={o.label}
                checked={form.capacity.includes(o.key)}
                onChange={(on) =>
                  set(
                    'capacity',
                    on ? [...form.capacity, o.key] : form.capacity.filter((c) => c !== o.key)
                  )
                }
              />
            ))}
          </div>
          {givesForOrg && (
            <TextInput
              value={form.org}
              onChange={(v) => set('org', v)}
              placeholder="For what org?"
              autoComplete="organization"
              className="mt-1"
            />
          )}
        </Q>
      </Section>

      <Section id="giving" title="Your giving">
        <Q label="How much in total are you looking to give in 2026?">
          <Pills
            options={GIVING_BANDS}
            value={(form.giving_2026 as any) || null}
            onChange={(k) => set('giving_2026', k)}
          />
        </Q>
        <Q label="And in 2027?">
          <Pills
            options={GIVING_BANDS_2027}
            value={(form.giving_2027 as any) || null}
            onChange={(k) => set('giving_2027', k)}
          />
        </Q>
        <Q
          label="Which cause areas are you interested in, and in what proportion?"
          className="gap-4"
        >
          <CauseSliders value={causes} onChange={setCauses} />
        </Q>
        <Q
          label="Where do you currently go for advice about effective giving?"
          as="label"
          className="gap-2.5"
        >
          <TextInput
            value={form.advice_sources}
            onChange={(v) => set('advice_sources', v)}
            placeholder="People, orgs, newsletters, forums…"
          />
        </Q>
        <Q
          label="What are your biggest problems with the current giving landscape?"
          as="label"
          className="gap-2.5"
        >
          <TextArea
            value={form.landscape_problems}
            onChange={(v) => set('landscape_problems', v)}
            placeholder="Be blunt."
            rows={4}
          />
        </Q>
      </Section>

      <Section id="deeper" title="Going deeper" badge="Optional">
        {!optionalOpen ? (
          <button
            type="button"
            onClick={() => setOptionalOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-dashed border-gray-300 bg-[#fafafa] px-[18px] py-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-normal text-gray-900">
                Six more questions on how you like to give
              </span>
              <span className="text-[13px] text-gray-500">
                Funds vs. charities, evaluation, your dream setup — about 4 minutes
              </span>
            </span>
            <span className="whitespace-nowrap text-sm font-normal text-orange-600">
              Show them →
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-9">
            <Q
              label="Giving to funds (like Longview or Coefficient Giving) vs. picking charities yourself — where do you land?"
              className="gap-4"
            >
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={25}
                  value={fundsPct}
                  aria-label="Funds vs. picking charities yourself"
                  onChange={(e) => {
                    setFundsTouched(true)
                    set('funds_vs_direct', Number(e.target.value))
                  }}
                  className="w-full cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>All funds</span>
                  <span>25%</span>
                  <span>50/50</span>
                  <span>75%</span>
                  <span>All my own picks</span>
                </div>
              </div>
              <span className="self-start rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-normal text-orange-700">
                {FUNDS_LABELS[fundsPct]}
              </span>
            </Q>
            <Q label="Where have you already given, and roughly how much?" className="gap-2.5">
              <TextArea
                value={form.already_given}
                onChange={(v) => set('already_given', v)}
                placeholder="e.g. GiveWell $50k, LTFF $20k, a few direct grants…"
                rows={3}
              />
              <TextInput
                value={form.already_given_link}
                onChange={(v) => set('already_given_link', v)}
                placeholder="…or drop in a link to your giving history"
                type="url"
              />
            </Q>
            <Q
              label="How do you evaluate funds? How do you evaluate charities?"
              as="label"
              className="gap-2.5"
            >
              <TextArea
                value={form.evaluation_approach}
                onChange={(v) => set('evaluation_approach', v)}
                rows={4}
              />
            </Q>
            <Q
              label="What are some charities you might like to give to?"
              as="label"
              className="gap-2.5"
            >
              <TextArea
                value={form.charities_interested}
                onChange={(v) => set('charities_interested', v)}
                rows={3}
              />
            </Q>
            <Q
              label="How many hours per month would you ideally spend on donating your money?"
              hint="Looking at opportunities, talking to people, thinking."
            >
              <Pills
                options={HOURS_BANDS}
                value={(form.hours_per_month as any) || null}
                onChange={(k) => set('hours_per_month', form.hours_per_month === k ? '' : k)}
              />
            </Q>
            <Q
              label="What would your dream setup for donating your money look like?"
              hint="Finding opportunities yourself? Your own foundation with employees? Pooling with other donors? Cause-area funds?"
              as="label"
              className="gap-2.5"
            >
              <TextArea value={form.dream_setup} onChange={(v) => set('dream_setup', v)} rows={5} />
            </Q>
          </div>
        )}
      </Section>

      <Section id="touch" title="Staying in touch">
        <Q label="Would you like me to send you opportunities I think you’d like?">
          <Pills
            options={YES_NO}
            size="wide"
            value={
              form.wants_opportunities === null ? null : form.wants_opportunities ? 'yes' : 'no'
            }
            onChange={(k) => set('wants_opportunities', k === 'yes')}
          />
          {form.wants_opportunities && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm text-gray-500">How often?</span>
              <Pills
                options={FREQUENCIES}
                size="sm"
                value={(form.opportunity_frequency as any) || null}
                onChange={(k) => set('opportunity_frequency', k)}
              />
            </div>
          )}
        </Q>
        <Q label="Would you like to…">
          <div className="flex flex-col gap-2">
            <CheckCard
              label="Meet for a 1:1 call with a member of the Manifund team"
              checked={form.wants_call}
              onChange={(v) => set('wants_call', v)}
            />
            <CheckCard
              label="Come to events centered on fundraising for top charities"
              checked={form.wants_events}
              onChange={(v) => set('wants_events', v)}
            />
          </div>
        </Q>
        <Q label="Would you be willing to share your personal answers…">
          <div className="flex flex-col gap-2">
            <CheckCard
              label="With other major funders"
              sub="Such as Coefficient Giving, Longview, Macroscopic, AISTOF"
              checked={form.share_with_funders}
              onChange={(v) => set('share_with_funders', v)}
            />
            <CheckCard
              label="On your public Manifund profile"
              sub={
                <>
                  You can change this later — example:{' '}
                  <a
                    href="/Austin/donor"
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-600 hover:underline"
                  >
                    manifund.org/Austin/donor
                  </a>
                </>
              }
              checked={form.is_public}
              onChange={(v) => set('is_public', v)}
            />
            {form.is_public && !user && (
              <p className="text-[13px] text-gray-500">
                Public pages need a Manifund account. Sign in above and your answers will show at
                manifund.org/&lt;username&gt;/donor.
              </p>
            )}
          </div>
        </Q>
      </Section>

      <Section id="last" title="Last two">
        <Q label="Other thoughts on effective giving?" as="label" className="gap-2.5">
          <TextArea
            value={form.other_thoughts}
            onChange={(v) => set('other_thoughts', v)}
            rows={4}
          />
        </Q>
        <Q
          label="Who else should take this survey?"
          hint="If you include contact info, we’ll reach out and mention you recommended them."
          as="label"
          className="gap-2.5"
        >
          <TextArea value={form.referrals} onChange={(v) => set('referrals', v)} rows={3} />
        </Q>
      </Section>

      <section className="flex flex-col gap-3 pt-2">
        {showErrors && missing.length > 0 && (
          <div
            role="alert"
            className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            Still needed: {missing.join(', ')}.
          </div>
        )}
        {serverError && (
          <div
            role="alert"
            className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-[52px] w-full rounded-[12px] bg-orange-500 text-base font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEditing
            ? 'Save and see what other donors said'
            : 'Submit and see what other donors said'}
        </button>
        <span className="text-center text-[13px] text-gray-400">
          Your answers stay private unless you opted to share them above.
        </span>
      </section>
    </form>
  )
}

type SectionProgress = { id: string; title: string; done: number; of: number; optional?: boolean }

function count(...flags: boolean[]) {
  return flags.filter(Boolean).length
}

// One segment per section, filled by how much of that section is answered.
// The segment for the section currently on screen is highlighted, and its
// name shows under the bar. Clicking a segment jumps to the section.
function ProgressBar(props: { sections: SectionProgress[] }) {
  const { sections } = props
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    const onScroll = () => {
      const line = window.scrollY + window.innerHeight * 0.35
      let current = sections[0]?.id
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.offsetTop <= line) current = s.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  const activeSection = sections.find((s) => s.id === active)

  return (
    <div className="fixed inset-x-0 top-0 z-10">
      <div className="flex h-1.5 gap-[3px] bg-white">
        {sections.map((s) => {
          const pct = s.of ? Math.round((s.done / s.of) * 100) : 0
          const isActive = s.id === active
          return (
            <button
              key={s.id}
              type="button"
              title={`${s.title}: ${s.done} of ${s.of}${s.optional ? ' (optional)' : ''}`}
              aria-label={`Go to ${s.title}`}
              onClick={() =>
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className={clsx(
                'relative h-full flex-1 overflow-hidden transition-colors',
                isActive ? 'bg-orange-200' : 'bg-gray-100 hover:bg-gray-200'
              )}
            >
              <span
                className={clsx(
                  'absolute inset-y-0 left-0 transition-[width] duration-300 ease-out',
                  isActive ? 'bg-orange-500' : 'bg-orange-400'
                )}
                style={{ width: `${pct}%` }}
              />
            </button>
          )
        })}
      </div>
      {activeSection && (
        <div className="pointer-events-none flex justify-end px-4 pt-1.5">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-gray-500 shadow-sm ring-1 ring-gray-100">
            {activeSection.title}
          </span>
        </div>
      )}
    </div>
  )
}
