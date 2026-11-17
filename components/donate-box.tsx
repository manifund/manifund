'use client'
import { TimeLeftDisplay } from '@/app/projects/[slug]/time-left-display'
import { scrollToComments } from '@/app/projects/[slug]/project-display'
import { Button } from '@/components/button'
import { Card } from '@/components/layout/card'
import { AmountInput } from '@/components/input'
import { Profile } from '@/db/profile'
import type { GivingFund } from '@/db/fund'
import { Project } from '@/db/project'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Row } from './layout/row'
import { SignInButton } from './sign-in-button'
import { DepositButton } from './deposit-buttons'
import { buttonClass } from './button'
import { donationLimitError, MIN_DONATION, usd } from '@/utils/donation-limits'
import clsx from 'clsx'

const PRESETS = [50, 100, 500, 1000]
const DEFAULT_AMOUNT = 100

export function DonateBox(props: {
  charity?: Profile
  project?: Project
  profile?: Profile
  maxDonation: number
  // What's left of a grant project's funding goal (fundingLeft); the server applies the same cap.
  fundingLeft?: number
  setCommentPrompt?: (value: string) => void
  // Funds the viewer administers and can give as instead (F2).
  givingFunds?: GivingFund[]
  // Inside another card that already shows the heading and what's left (the project page's rail)
  embedded?: boolean
}) {
  const { charity, project, profile, fundingLeft, setCommentPrompt, givingFunds = [] } = props
  // A suggested amount to start from, when the viewer can give it and the project can take it.
  const [amount, setAmount] = useState<number | undefined>(() =>
    profile &&
    props.maxDonation >= DEFAULT_AMOUNT &&
    (fundingLeft === undefined || fundingLeft >= DEFAULT_AMOUNT)
      ? DEFAULT_AMOUNT
      : undefined
  )
  const [asFundId, setAsFundId] = useState<string>()
  const asFund = givingFunds.find((g) => g.fund.id === asFundId)
  const maxDonation = asFund ? asFund.balance : props.maxDonation
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const router = useRouter()
  const isBid = project && project.stage === 'proposal'

  const available = Math.max(0, Math.floor(maxDonation * 100) / 100)
  // Too little to give even the smallest allowed amount: offer to add funds instead of an amount box.
  const needsFunds = available < Math.min(MIN_DONATION, fundingLeft ?? MIN_DONATION)
  const overBalance = !!amount && amount > maxDonation

  let errorMessage = null
  if (overBalance) {
    errorMessage = `${asFund ? asFund.fund.full_name + ' has' : 'You have'} ${usd(available)} to give.`
  } else if (amount) {
    errorMessage = donationLimitError(amount, fundingLeft ?? null)
  }

  const donate = async () => {
    setIsSubmitting(true)
    setRefusal(null)
    if (!profile) {
      return
    }
    let response: Response | undefined
    if (project && project.stage === 'proposal') {
      response = await fetch('/api/place-bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          valuation: 0,
          amount,
          type: 'donate',
          asFundId,
        }),
      }).catch(() => undefined)
    } else if (project || charity) {
      response = await fetch('/api/transfer-money', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromId: asFundId ?? profile.id,
          toId: charity?.id ?? project?.creator,
          amount,
          projectId: project?.id,
        }),
      }).catch(() => undefined)
    }
    setIsSubmitting(false)
    // A refusal by the server (e.g. someone else's offer just reached the goal): its own words when it gave
    // them (400 with a text body), a generic line otherwise.
    if (!response?.ok) {
      const text = response && response.status === 400 ? await response.text() : ''
      setRefusal(text || "That didn't go through. Nothing was charged; try again.")
      return
    }
    setAmount(0)
    router.refresh()
    if (setCommentPrompt) {
      scrollToComments()
      setCommentPrompt('why did you donate?')
    }
  }
  const verb = isBid ? 'Offer' : 'Donate'
  const presets = PRESETS.filter((preset) => fundingLeft === undefined || preset <= fundingLeft)
  const body = (
    <div className="flex flex-col gap-3">
      {!props.embedded && (
        <div>
          <Row className="items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium text-gray-900">
              {isBid ? 'Offer to donate' : 'Donate'}
            </h2>
            {isBid && project.auction_close && (
              <TimeLeftDisplay closeDate={project.auction_close} />
            )}
          </Row>
          {fundingLeft !== undefined && (
            <p className="text-sm text-gray-500">
              {usd(fundingLeft)} left to reach the funding goal.
            </p>
          )}
        </div>
      )}
      {charity?.type === 'individual' && (
        <p className="text-sm text-gray-500">
          This is a donation to this user&apos;s regranting budget, which is not withdrawable.
        </p>
      )}
      {profile && givingFunds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Give as</span>
          <div className="inline-flex rounded-md bg-gray-100 p-0.5">
            {[
              { id: undefined, name: 'You' },
              ...givingFunds.map((g) => ({ id: g.fund.id, name: g.fund.full_name })),
            ].map((option) => (
              <button
                key={option.id ?? 'self'}
                type="button"
                aria-pressed={asFundId === option.id}
                onClick={() => setAsFundId(option.id)}
                className={clsx(
                  'rounded px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                  asFundId === option.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                )}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {profile && asFund && needsFunds ? (
        <p className="text-sm text-gray-500">
          {asFund.fund.full_name} has {usd(available)} to give.
        </p>
      ) : profile && needsFunds ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-500">
            You have {usd(available)} to give. Add funds to your balance to donate.
          </p>
          <DepositButton userId={profile.id}>
            <span className={clsx(buttonClass('lg', 'orange'), 'w-full')}>Add funds</span>
          </DepositButton>
        </div>
      ) : profile ? (
        <div className="flex flex-col gap-2">
          {presets.length > 1 && (
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={amount === preset}
                  onClick={() => setAmount(preset)}
                  className={clsx(
                    'rounded-md border py-2 text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                    amount === preset
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  )}
                >
                  ${preset.toLocaleString()}
                </button>
              ))}
            </div>
          )}
          <AmountInput
            id="amount"
            amount={amount}
            placeholder={presets.length > 1 ? 'Other amount' : 'Amount (USD)'}
            onChangeAmount={setAmount}
            error={!!errorMessage}
            className="w-full"
          />
          <Button
            onClick={donate}
            size="lg"
            className="mt-1 w-full"
            disabled={!amount || errorMessage !== null}
            loading={isSubmitting}
          >
            {amount ? `${verb} ${usd(amount)}` : verb}
          </Button>
        </div>
      ) : (
        <SignInButton buttonText="Sign in to donate" size="lg" color="orange" className="w-full" />
      )}
      {profile && errorMessage && (
        <p className="text-sm text-rose-600">
          {errorMessage}{' '}
          {overBalance && !asFund && (
            <DepositButton userId={profile.id}>
              <span className="font-medium underline">Add funds</span>
            </DepositButton>
          )}
        </p>
      )}
      {profile && refusal && <p className="text-sm text-rose-600">{refusal}</p>}
    </div>
  )
  return props.embedded ? body : <Card className="p-5">{body}</Card>
}
