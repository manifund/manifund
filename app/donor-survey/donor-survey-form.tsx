'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import * as RxSlider from '@radix-ui/react-slider'
import clsx from 'clsx'
import Link from 'next/link'
import { Button, buttonClass } from '@/components/button'
import {
  CAPACITIES,
  DEFAULT_CAUSE_ALLOCATION,
  FREQUENCIES,
  FUNDS_VS_DIRECT_STOPS,
  GIVING_BANDS,
  GIVING_BANDS_2027,
  HOURS_BANDS,
  type CauseAllocation,
} from '@/utils/donor-survey'
import { saveDonorSurvey, type DonorSurveyInput, type SaveResult } from './actions'
import { CauseAllocationField } from './cause-allocation'
import { CheckRow, Choices, Question, Section, TextArea, TextField } from './fields'

export type SignedInUser = { fullName: string; email: string; username: string }

const YES_NO = [
  { key: 'yes', label: 'yes' },
  { key: 'no', label: 'no' },
] as const

export function DonorSurveyForm(props: {
  initial: DonorSurveyInput | null
  user: SignedInUser | null
  token: string | null
}) {
  const { user, token } = props
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SaveResult | null>(null)
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
  const set = <K extends keyof DonorSurveyInput>(key: K, value: DonorSurveyInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const error = result?.type === 'error' ? result : null
  const errorFor = (field: keyof DonorSurveyInput) =>
    error?.field === field ? error.text : undefined
  const isEditing = props.initial !== null
  const givesForOrg = form.capacity.some((c) => c !== 'own_money')

  const submit = () => {
    setResult(null)
    startTransition(async () => {
      const res = await saveDonorSurvey(form, token)
      setResult(res)
      if (res.type === 'saved') {
        router.push('/donor-survey/results')
        return
      }
      if (res.type === 'error' && res.field) {
        document
          .getElementById(`q-${res.field}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }

  if (result?.type === 'existing') {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-orange-200 bg-orange-50 p-6">
        <p className="text-lg font-medium text-gray-900">
          There are already answers under {result.email}.
        </p>
        <p className="text-gray-700">
          We just emailed a link to that address. Open it to change your answers.
        </p>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-20"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Section title="Basic questions">
        {user ? (
          <p className="text-base text-gray-700">
            Signed in as <span className="font-medium text-gray-900">{user.fullName}</span> (
            {user.email})
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Link
              href="/login?next=/donor-survey"
              className={clsx(buttonClass('lg', 'orange-outline'), 'self-start')}
            >
              Sign in with Manifund
            </Link>
            <p className="text-sm text-gray-500">OR:</p>
          </div>
        )}
        {!user && (
          <>
            <Question label="full name" id="q-full_name" error={errorFor('full_name')}>
              <TextField
                value={form.full_name}
                onChange={(v) => set('full_name', v)}
                autoComplete="name"
                name="name"
              />
            </Question>
            <Question label="email" id="q-email" error={errorFor('email')}>
              <TextField
                value={form.email}
                onChange={(v) => set('email', v)}
                type="email"
                autoComplete="email"
                name="email"
              />
            </Question>
          </>
        )}
        <Question
          as="fieldset"
          label="in what capacity are you giving?"
          id="q-capacity"
          error={errorFor('capacity')}
        >
          <Choices
            options={CAPACITIES}
            multiple
            value={form.capacity}
            onChange={(k) =>
              set(
                'capacity',
                form.capacity.includes(k)
                  ? form.capacity.filter((c) => c !== k)
                  : [...form.capacity, k]
              )
            }
          />
        </Question>
        {givesForOrg && (
          <Question label="for what org?" id="q-org">
            <TextField
              value={form.org}
              onChange={(v) => set('org', v)}
              autoComplete="organization"
            />
          </Question>
        )}
      </Section>

      <Section title="Giving questions">
        <Question
          as="fieldset"
          label="How much in total are you looking to give, in 2026?"
          id="q-giving_2026"
          error={errorFor('giving_2026')}
        >
          <Choices
            options={GIVING_BANDS}
            columns={3}
            value={form.giving_2026 || null}
            onChange={(k) => set('giving_2026', k)}
          />
        </Question>
        <Question as="fieldset" label="In 2027?" id="q-giving_2027" error={errorFor('giving_2027')}>
          <Choices
            options={GIVING_BANDS_2027}
            columns={3}
            value={form.giving_2027 || null}
            onChange={(k) => set('giving_2027', k)}
          />
        </Question>
        <Question
          as="fieldset"
          label="What cause areas are you interested in? in what proportion?"
          id="q-cause_allocation"
          error={errorFor('cause_allocation')}
        >
          <CauseAllocationField
            value={form.cause_allocation}
            onChange={(v: CauseAllocation) => set('cause_allocation', v)}
          />
        </Question>
        <Question
          label="Where do you currently go for advice about effective giving?"
          id="q-advice_sources"
        >
          <TextField value={form.advice_sources} onChange={(v) => set('advice_sources', v)} />
        </Question>
        <Question
          label="What are your biggest problems with the current giving landscape?"
          id="q-landscape_problems"
        >
          <TextArea
            value={form.landscape_problems}
            onChange={(v) => set('landscape_problems', v)}
          />
        </Question>
      </Section>

      <Section title="More giving questions" note="(optional)">
        <Question
          as="fieldset"
          label="how are you thinking about giving to funds (like Longview and CG) vs selecting individual charities yourself?"
          id="q-funds_vs_direct"
        >
          <FundsVsDirect value={form.funds_vs_direct} onChange={(v) => set('funds_vs_direct', v)} />
        </Question>
        <Question
          label="Where have you already given? (how much?)"
          hint="Or, drop in a link"
          id="q-already_given"
        >
          <TextArea value={form.already_given} onChange={(v) => set('already_given', v)} rows={3} />
        </Question>
        <Question
          label="How do you evaluate funds? How do you evaluate charities?"
          id="q-evaluation_approach"
        >
          <TextArea
            value={form.evaluation_approach}
            onChange={(v) => set('evaluation_approach', v)}
            rows={3}
          />
        </Question>
        <Question
          label="What are some charities you might like to give to?"
          id="q-charities_interested"
        >
          <TextArea
            value={form.charities_interested}
            onChange={(v) => set('charities_interested', v)}
            rows={3}
          />
        </Question>
        <Question
          as="fieldset"
          label="How many hours per month would you ideally spend on donating your money?"
          hint="(looking at opportunities, talking to people, thinking)"
          id="q-hours_per_month"
        >
          <Choices
            options={HOURS_BANDS}
            columns={3}
            value={form.hours_per_month || null}
            onChange={(k) => set('hours_per_month', form.hours_per_month === k ? '' : k)}
          />
        </Question>
        <Question
          label="What would your dream setup for donating your money look like?"
          hint="(Finding opportunities yourself? Having your own foundation with employees? Pooling with other donors? Donating to funds focused on cause areas? etc, etc)"
          id="q-dream_setup"
        >
          <TextArea value={form.dream_setup} onChange={(v) => set('dream_setup', v)} />
        </Question>
      </Section>

      <Section title="Comms questions">
        <Question
          as="fieldset"
          label="Would you like me to send you opportunities I think you would like?"
          id="q-wants_opportunities"
          error={errorFor('wants_opportunities')}
        >
          <Choices
            options={YES_NO}
            columns={2}
            value={
              form.wants_opportunities === null ? null : form.wants_opportunities ? 'yes' : 'no'
            }
            onChange={(k) => set('wants_opportunities', k === 'yes')}
          />
        </Question>
        {form.wants_opportunities && (
          <Question
            as="fieldset"
            label="How often?"
            id="q-opportunity_frequency"
            error={errorFor('opportunity_frequency')}
          >
            <Choices
              options={FREQUENCIES}
              columns={3}
              value={form.opportunity_frequency || null}
              onChange={(k) => set('opportunity_frequency', k)}
            />
          </Question>
        )}
        <Question as="fieldset" label="Would you like to:" id="q-wants_call">
          <div className="flex flex-col gap-2">
            <CheckRow checked={form.wants_call} onChange={(v) => set('wants_call', v)}>
              meet for 1:1 call with a member of Manifund team?
            </CheckRow>
            <CheckRow checked={form.wants_events} onChange={(v) => set('wants_events', v)}>
              come to events centered on fundraising for top charities?
            </CheckRow>
          </div>
        </Question>
        <Question
          as="fieldset"
          label="Would you be willing to share your personal answers:"
          id="q-share_with_funders"
        >
          <div className="flex flex-col gap-2">
            <CheckRow
              checked={form.share_with_funders}
              onChange={(v) => set('share_with_funders', v)}
            >
              With other major funders (such as CG, Longview, Macroscopic, AISTOF)
            </CheckRow>
            <CheckRow checked={form.is_public} onChange={(v) => set('is_public', v)}>
              On your public Manifund profile? (you can change this later)
              <span className="mt-1 block text-sm text-gray-500">
                example:{' '}
                <a
                  href="/Austin/donor"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-gray-300 underline-offset-2 hover:text-orange-600"
                >
                  manifund.org/Austin/donor
                </a>
              </span>
            </CheckRow>
            {form.is_public && !user && (
              <p className="text-sm text-gray-500">
                Public pages need a Manifund account. Sign in above and your answers will show at
                manifund.org/&lt;username&gt;/donor.
              </p>
            )}
          </div>
        </Question>
      </Section>

      <Section title="Misc">
        <Question label="Other thoughts on effective giving?" id="q-other_thoughts">
          <TextArea value={form.other_thoughts} onChange={(v) => set('other_thoughts', v)} />
        </Question>
        <Question
          label="Who else should take this survey?"
          hint="(if you provide contact info, we’ll reach out and say that you recommended them)"
          id="q-referrals"
        >
          <TextArea value={form.referrals} onChange={(v) => set('referrals', v)} rows={3} />
        </Question>
      </Section>

      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error.text}
          </p>
        )}
        <Button type="submit" size="2xl" color="gradient" loading={pending} className="self-start">
          {isEditing ? 'Save changes' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}

function FundsVsDirect(props: { value: number | null; onChange: (v: number | null) => void }) {
  const { value, onChange } = props
  const shown = value ?? 50
  return (
    <div className="flex flex-col gap-3">
      <RxSlider.Root
        className="relative flex h-6 w-full touch-none select-none items-center"
        value={[shown]}
        min={0}
        max={100}
        step={25}
        aria-label="funds vs individual charities"
        onValueChange={([v]) => onChange(v)}
      >
        <RxSlider.Track className="relative h-1.5 grow rounded-full bg-gray-200">
          <RxSlider.Range
            className={clsx(
              'absolute h-full rounded-full',
              value === null ? 'bg-gray-300' : 'bg-orange-500'
            )}
          />
          {FUNDS_VS_DIRECT_STOPS.map((stop) => (
            <span
              key={stop}
              aria-hidden
              className={clsx(
                'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white',
                value !== null && stop <= value ? 'bg-orange-500' : 'bg-gray-300'
              )}
              style={{ left: `${stop}%` }}
            />
          ))}
        </RxSlider.Track>
        <RxSlider.Thumb
          className={clsx(
            'block h-5 w-5 rounded-full border-2 bg-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40',
            value === null ? 'border-gray-400' : 'border-orange-500'
          )}
        />
      </RxSlider.Root>
      <div className="flex justify-between text-sm tabular-nums text-gray-500">
        {FUNDS_VS_DIRECT_STOPS.map((stop) => (
          <span key={stop}>{stop}%</span>
        ))}
      </div>
      <p className="text-sm text-gray-700">
        {value === null ? (
          <span className="text-gray-400">Drag to answer</span>
        ) : (
          <>
            {value}% to funds, {100 - value}% to individual charities
          </>
        )}
      </p>
    </div>
  )
}
