'use client'
import { TimeLeftDisplay } from '@/app/projects/[slug]/time-left-display'
import { scrollToComments } from '@/app/projects/[slug]/project-display'
import { Button } from '@/components/button'
import { Card } from '@/components/layout/card'
import { AmountInput } from '@/components/input'
import { Profile } from '@/db/profile'
import { Project } from '@/db/project'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Row } from './layout/row'
import { SignInButton } from './sign-in-button'
import { DepositButton } from './deposit-buttons'
import { buttonClass } from './button'
import { donationLimitError, MIN_DONATION, usd } from '@/utils/donation-limits'

export function DonateBox(props: {
  charity?: Profile
  project?: Project
  profile?: Profile
  maxDonation: number
  // What's left of a grant project's funding goal (fundingLeft); the server applies the same cap.
  fundingLeft?: number
  setCommentPrompt?: (value: string) => void
}) {
  const { charity, project, profile, maxDonation, fundingLeft, setCommentPrompt } = props
  const [amount, setAmount] = useState<number>()
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
    errorMessage = `You have ${usd(available)} to give.`
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
        }),
      }).catch(() => undefined)
    } else if (project || charity) {
      response = await fetch('/api/transfer-money', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromId: profile.id,
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
      scrollToComments(router)
      setCommentPrompt('why did you donate?')
    }
  }
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <Row className="justify-between">
          <h2 className="text-lg font-bold">{isBid ? 'Offer to donate' : 'Donate'}</h2>
          {isBid && <TimeLeftDisplay closeDate={project.auction_close ?? ''} />}
        </Row>
        {isBid && (
          <p className="text-sm font-light text-gray-500">
            You&apos;re pledging to donate if the project hits its minimum goal and gets approved.
            If not, your funds will be returned.
          </p>
        )}
        {fundingLeft !== undefined && (
          <p className="text-sm text-gray-500">
            {usd(fundingLeft)} left to reach the funding goal.
          </p>
        )}
        {charity?.type === 'individual' && (
          <p className="text-sm text-gray-500">
            This is a donation to this user&apos;s regranting budget, which is not withdrawable.
          </p>
        )}
      </div>
      {profile && needsFunds ? (
        <Row className="items-center justify-between gap-2">
          <span className="text-sm text-gray-500">You have {usd(available)} to give.</span>
          <DepositButton userId={profile.id}>
            <span className={buttonClass('md', 'orange')}>Add funds</span>
          </DepositButton>
        </Row>
      ) : profile ? (
        <Row className="items-center justify-between gap-2">
          <AmountInput
            id="amount"
            amount={amount}
            placeholder="Amount (USD)"
            onChangeAmount={setAmount}
            className="w-48 max-w-full"
          />
          <Button
            onClick={donate}
            className="font-semibold"
            disabled={!amount || errorMessage !== null}
            loading={isSubmitting}
          >
            Donate
          </Button>
        </Row>
      ) : (
        <SignInButton buttonText="Sign in to donate" className="mx-auto my-4" />
      )}
      {profile && errorMessage && (
        <p className="text-sm text-rose-600">
          {errorMessage}{' '}
          {overBalance && (
            <DepositButton userId={profile.id}>
              <span className="font-semibold underline">Add funds</span>
            </DepositButton>
          )}
        </p>
      )}
      {profile && refusal && <p className="text-sm text-rose-600">{refusal}</p>}
    </Card>
  )
}
