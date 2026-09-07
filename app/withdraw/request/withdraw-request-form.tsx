'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import {
  ArrowLeftCircleIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/20/solid'
import { Button } from '@/components/button'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { Input } from '@/components/input'
import { WithdrawalRequest } from '@/db/withdrawal-request'
import { mercuryMinWithdrawal } from '@/utils/constants'
// Precise, not formatMoney: abbreviating a balance to "$12.4K" would hide the
// exact amount someone is allowed to withdraw.
import { formatMoneyPrecise } from '@/utils/formatting'

type Destination = 'us' | 'international'

// What the page shows: either a request the server handed us, or one we just
// created and haven't been re-rendered with yet.
type Pending = {
  id?: string
  status: string
  amount: number
  onboardingUrl: string | null
}

export function WithdrawRequestForm(props: {
  withdrawBalance: number
  openRequest: WithdrawalRequest | null
  hasRecipient: boolean
  // Set when we already know which method their recipient accepts, so there's
  // nothing to ask. Null for a first-time withdrawer.
  knownPaymentMethod?: 'ach' | 'internationalWire' | null
}) {
  const { openRequest, hasRecipient, knownPaymentMethod } = props
  // Floor to cents: the raw float sum can carry dust Mercury would reject.
  const withdrawBalance = Math.floor(props.withdrawBalance * 100) / 100
  const router = useRouter()
  // Held as text, not a number: Number('') is 0, so a numeric state would snap a
  // cleared field back to "0" and typing would then build "01000".
  const [amountText, setAmountText] = useState(String(withdrawBalance))
  const [destination, setDestination] = useState<Destination>('us')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted] = useState<Pending | null>(null)

  // Prefer the server's copy once it arrives; fall back to what we just created
  // so the view flips over immediately rather than waiting on router.refresh().
  const pending: Pending | null = openRequest
    ? {
        id: openRequest.id,
        status: openRequest.status,
        amount: Number(openRequest.amount),
        onboardingUrl: openRequest.mercury_onboarding_url,
      }
    : justSubmitted

  const amount = amountText === '' ? NaN : Number(amountText)
  const minWithdrawal = mercuryMinWithdrawal(withdrawBalance)
  const awaitingDetails = pending?.status === 'awaiting_recipient'

  // Defensive refresh only: nothing in the flow requires the grantee to come
  // back here, but if they do, don't show a stale "we need your bank details".
  const pendingId = pending?.id
  useEffect(() => {
    if (!awaitingDetails || !pendingId) return
    const refresh = async () => {
      try {
        await fetch(`/api/mercury-sync?requestId=${pendingId}`, { method: 'POST' })
        router.refresh()
      } catch {
        // Harmless; the hourly cron will catch up.
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingDetails, pendingId])

  if (withdrawBalance <= 0 && !pending) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-gray-900">Nothing to withdraw</h1>
        <p className="mt-2 text-sm text-gray-500">
          You don&apos;t have any withdrawable funds in your Manifund account right now.
        </p>
      </Shell>
    )
  }

  if (pending && !awaitingDetails) {
    return (
      <Shell>
        <Row className="items-center gap-2">
          <CheckCircleIcon className="h-6 w-6 text-emerald-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">Withdrawal in progress</h1>
        </Row>
        <p className="mt-2 text-sm text-gray-500">
          {`We have your bank details and your withdrawal of ${formatMoneyPrecise(pending.amount)} is queued for approval. We'll email you as soon as the money is on its way — usually within a few business days. Nothing more for you to do.`}
        </p>
      </Shell>
    )
  }

  if (awaitingDetails && pending) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-gray-900">One step left</h1>
        <p className="mt-2 text-sm text-gray-500">
          {`Enter your bank details with Mercury, our bank, to finish your withdrawal of ${formatMoneyPrecise(pending.amount)}. Mercury also emailed you this link.`}
        </p>
        {pending.onboardingUrl && (
          <a
            href={pending.onboardingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-x-2 self-start rounded-md bg-orange-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            Enter your bank details
            <ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
        <p className="mt-5 text-xs text-gray-400">
          {`Your ${formatMoneyPrecise(pending.amount)} is being held while we wait, so it won't be spent elsewhere.`}
        </p>
      </Shell>
    )
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/mercury-withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dollarAmount: amount, destination, feedback }),
      })
      const json = await response.json()
      if (!response.ok) {
        setError(json.error ?? 'Something went wrong. Please try again or email info@manifund.org.')
        return
      }
      setJustSubmitted({ status: json.status, amount, onboardingUrl: json.onboardingUrl ?? null })
      if (json.onboardingUrl) {
        window.open(json.onboardingUrl, '_blank', 'noopener,noreferrer')
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again or email info@manifund.org.')
    } finally {
      setSubmitting(false)
    }
  }

  const amountError = !amountText
    ? 'Enter an amount.'
    : !Number.isFinite(amount)
      ? 'Enter a valid amount.'
      : amount > withdrawBalance
        ? `You can withdraw at most ${formatMoneyPrecise(withdrawBalance)}.`
        : amount < minWithdrawal
          ? `Minimum Mercury withdrawal is ${formatMoneyPrecise(minWithdrawal)}.`
          : null

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-gray-900">Withdraw to your bank</h1>

      <Col className="mt-6 gap-1">
        <label htmlFor="amount" className="text-sm font-medium text-gray-900">
          Amount
        </label>
        <Row className="items-center gap-2">
          <span className="text-lg text-gray-500">$</span>
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            value={amountText}
            error={!!amountError}
            onChange={(event) => setAmountText(cleanAmount(event.target.value))}
            className="w-40"
          />
          <button
            type="button"
            className="text-sm text-orange-600 hover:underline"
            onClick={() => setAmountText(String(withdrawBalance))}
          >
            Withdraw everything
          </button>
        </Row>
        <span className={clsx('text-xs', amountError ? 'text-rose-600' : 'text-gray-400')}>
          {amountError ??
            `You have ${formatMoneyPrecise(withdrawBalance)} available. Minimum Mercury withdrawal is ${formatMoneyPrecise(minWithdrawal)}.`}
        </span>
      </Col>

      {!knownPaymentMethod && (
        <Col className="mt-6 gap-2">
          <span className="text-sm font-medium text-gray-900">Where is your bank account?</span>
          {(
            [
              ['us', 'US'],
              ['international', 'International'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={clsx(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                destination === value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:bg-gray-50'
              )}
            >
              <input
                type="radio"
                name="destination"
                className="mt-1 text-orange-600"
                checked={destination === value}
                onChange={() => setDestination(value)}
              />
              <span className="text-sm font-medium text-gray-900">{label}</span>
            </label>
          ))}
        </Col>
      )}

      <Col className="mt-6 gap-1">
        <label htmlFor="feedback" className="text-sm font-medium text-gray-900">
          Any other notes, or feedback for us? <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="feedback"
          rows={5}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={
            'E.g. what was good about your Manifund experience? What could be improved?\n\n(if you say nice things, we might use it as a testimonial -- thanks!)'
          }
          className="rounded-md border border-gray-300 p-3 text-sm shadow-sm focus:border-orange-500 focus:outline-none"
        />
      </Col>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      <Row className="mt-8 items-center justify-between">
        <button
          className="inline-flex items-center gap-x-2 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          onClick={() => router.push('/withdraw')}
        >
          <ArrowLeftCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
          Back
        </button>
        <Button
          onClick={submit}
          disabled={!!amountError || submitting}
          loading={submitting}
          size="lg"
        >
          {hasRecipient ? 'Request withdrawal' : 'Continue to bank details'}
        </Button>
      </Row>
      <p className="mt-3 text-right text-xs text-gray-400">
        {hasRecipient
          ? "We already have your bank details, so this is the last step. We'll email you when the money is on its way."
          : "Next you'll enter your bank details with Mercury. That's the last thing you need to do — we'll email you when the money is on its way."}
      </p>
    </Shell>
  )
}

// Digits and at most one decimal point. Leading zeros are dropped so typing into
// a field that already reads "0" doesn't produce "01000".
function cleanAmount(raw: string) {
  const digitsAndDot = raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
  return digitsAndDot.replace(/^0+(?=\d)/, '')
}

function Shell(props: { children: React.ReactNode }) {
  return (
    <Row className="w-full justify-center p-6 sm:p-10">
      <Col className="w-full max-w-xl">{props.children}</Col>
    </Row>
  )
}
