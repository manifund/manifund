'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/button'
import { AmountInput } from '@/components/input'
import { SignInButton } from '@/components/sign-in-button'
import type { Profile } from '@/db/profile'
import type { Project } from '@/db/project'

const PRESETS = [50, 100, 500, 1000]
const MIN_DONATION = 10

// Donating to an org is donating to its project on Manifund: an offer while the project is a proposal, a
// donation once it's active (the same two requests as the project page's donate box).
export function OrgDonateBox(props: {
  orgName: string
  project: Project
  profile?: Profile
  maxDonation: number
}) {
  const { orgName, project, profile, maxDonation } = props
  const [amount, setAmount] = useState<number | undefined>(100)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const router = useRouter()
  const isOffer = project.stage === 'proposal'

  let errorMessage: string | null = null
  if (amount && amount > maxDonation) {
    errorMessage = `Your balance covers up to $${Math.max(0, Math.floor(maxDonation)).toLocaleString()}.`
  } else if (amount && amount < MIN_DONATION) {
    errorMessage = `The minimum is $${MIN_DONATION}.`
  }

  const choose = (value: number | undefined) => {
    setAmount(value)
    setSent(false)
    setFailed(false)
  }

  const donate = async () => {
    if (!profile || !amount) return
    setIsSubmitting(true)
    setFailed(false)
    // The older money routes answer a refusal with a network error rather than a status.
    const body = isOffer
      ? { projectId: project.id, valuation: 0, amount, type: 'donate' }
      : { fromId: profile.id, toId: project.creator, amount, projectId: project.id }
    const ok = await fetch(isOffer ? '/api/place-bid' : '/api/transfer-money', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(
      (response) => response.ok,
      () => false
    )
    setIsSubmitting(false)
    if (!ok) {
      setFailed(true)
      return
    }
    setSent(true)
    router.refresh()
  }

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <div className="font-medium text-gray-900">Donate to {orgName}</div>
      <p className="mt-1 text-[13px] leading-normal text-gray-500">
        {isOffer
          ? 'An offer from your Manifund balance, charged only if the fundraiser reaches its minimum.'
          : 'From your Manifund balance.'}
      </p>
      {profile ? (
        <>
          <div className="mt-3.5 grid grid-cols-4 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={amount === preset}
                onClick={() => choose(preset)}
                className={clsx(
                  'rounded-md border py-2 text-sm font-normal transition-colors',
                  amount === preset
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                )}
              >
                ${preset.toLocaleString()}
              </button>
            ))}
          </div>
          <AmountInput
            amount={amount}
            onChangeAmount={choose}
            placeholder="Other amount"
            className="mt-2.5 w-full"
            error={errorMessage !== null}
          />
          <Button
            className="mt-3 w-full"
            size="lg"
            onClick={donate}
            disabled={!amount || errorMessage !== null}
            loading={isSubmitting}
          >
            {amount ? `${isOffer ? 'Offer' : 'Donate'} $${amount.toLocaleString()}` : 'Donate'}
          </Button>
          {errorMessage && <p className="mt-2.5 text-[13px] text-rose-600">{errorMessage}</p>}
          {failed && (
            <p className="mt-2.5 text-[13px] text-rose-600">
              That didn&apos;t go through. Nothing was charged; try again.
            </p>
          )}
          {sent && (
            <p className="mt-2.5 text-[13px] text-emerald-600">
              {isOffer ? 'Offer placed.' : 'Sent.'} Thank you!
            </p>
          )}
        </>
      ) : (
        <SignInButton buttonText="Sign in to donate" className="mt-4 w-full" />
      )}
      <p className="mt-3 text-xs leading-normal text-gray-400">
        Goes to{' '}
        <Link href={`/projects/${project.slug}`} className="text-orange-600 hover:underline">
          {project.title}
        </Link>
        , {orgName}&apos;s fundraiser on Manifund.
      </p>
    </div>
  )
}
