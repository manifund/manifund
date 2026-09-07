'use client'
import React from 'react'
import { Button } from '@/components/button'
import { Input } from '@/components/input'
import { Row } from '@/components/layout/row'
import { Tooltip } from '@/components/tooltip'
import { AccountStatus, WithdrawalDetails } from '@/components/withdrawal-details'
import { ArrowLeftCircleIcon, CheckCircleIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Stripe from 'stripe'
import { StepsDisplay } from './steps-display'
import { MERCURY_ENABLED } from '@/utils/constants'

export type Step = {
  id: number
  name: string
  display: React.JSX.Element
}

export function WithdrawalSteps(props: {
  accountStatus: AccountStatus
  withdrawalMethod?: Stripe.BankAccount | Stripe.Card
  userId: string
  withdrawBalance: number
  loginUrl?: string
}) {
  const { accountStatus, withdrawalMethod, userId, withdrawBalance, loginUrl } = props
  const router = useRouter()
  const [withdrawAmount, setWithdrawAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const isBank = withdrawalMethod?.object === 'bank_account'
  const steps = [
    {
      id: 1,
      name: 'Withdrawal details',
      display: (
        <WithdrawalDetails
          accountStatus={accountStatus}
          withdrawalMethod={withdrawalMethod}
          userId={userId}
          loginUrl={loginUrl}
        />
      ),
    },
    {
      id: 2,
      name: 'Select amount',
      display: (
        <SelectWithdrawAmount
          withdrawAmount={withdrawAmount}
          setWithdrawAmount={setWithdrawAmount}
          withdrawBalance={withdrawBalance}
        />
      ),
    },
    {
      id: 3,
      name: 'Confirm withdrawal',
      display: (
        <ConfirmWithdrawal
          withdrawalMethod={withdrawalMethod}
          isBank={isBank}
          withdrawAmount={withdrawAmount}
          complete={complete}
          setComplete={setComplete}
        />
      ),
    },
  ] as Step[]

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const nextStep = () => {
    setIsSubmitting(true)
    if (currentStepIdx + 1 === steps.length) {
      router.push('/')
    } else {
      setCurrentStepIdx(currentStepIdx + 1)
      setIsSubmitting(false)
    }
  }
  const previousStep = () => {
    setIsSubmitting(true)
    if (currentStepIdx === 0) {
      router.push('/')
    } else {
      setCurrentStepIdx(currentStepIdx - 1)
      setIsSubmitting(false)
    }
  }

  let errorMessage = null
  if (accountStatus !== 'complete' && currentStepIdx === 0) {
    errorMessage = 'You need to set up your Stripe account before continuing.'
  } else if (withdrawAmount < 1 && currentStepIdx === 1) {
    errorMessage = 'Minimum withdrawal is $1.'
  } else if (withdrawAmount > 10000) {
    // The cap stays; it just isn't a dead end any more.
    errorMessage = MERCURY_ENABLED
      ? 'Maximum automatic withdrawal is $10,000. Use "Withdraw to your bank" for larger amounts.'
      : 'Maximum automatic withdrawal is $10,000.'
  } else if (withdrawAmount > withdrawBalance && currentStepIdx === 1) {
    errorMessage = `Your withdrawable balance is only $${withdrawBalance}.`
  } else if (!complete && currentStepIdx === 2) {
    errorMessage = 'Complete your withdrawal to continue.'
  } else {
    errorMessage = null
  }

  return (
    <>
      <StepsDisplay steps={steps} currentStepId={currentStepIdx + 1} complete={complete} />
      <Row className="w-full justify-center p-10">
        <div className="w-full max-w-2xl">
          {steps[currentStepIdx].display}
          <Row className="mt-10 justify-between">
            <button
              className={clsx(
                'inline-flex items-center gap-x-2 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
                complete ? 'invisible' : ''
              )}
              onClick={() => previousStep()}
            >
              <ArrowLeftCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
              Back
            </button>
            <Tooltip text={errorMessage ?? ''}>
              <Button
                className="inline-flex items-center gap-x-2 rounded-md bg-orange-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:bg-gray-300"
                onClick={() => nextStep()}
                disabled={errorMessage !== null}
                loading={isSubmitting}
              >
                <CheckCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                {currentStepIdx === 2 ? 'Return to Manifund' : 'Confirm & continue'}
              </Button>
            </Tooltip>
          </Row>
        </div>
      </Row>
    </>
  )
}

function SelectWithdrawAmount(props: {
  withdrawBalance: number
  withdrawAmount: number
  setWithdrawAmount: (amount: number) => void
}) {
  const { withdrawBalance, withdrawAmount, setWithdrawAmount } = props
  return (
    <div>
      <label htmlFor="price" className="block font-medium leading-6 text-gray-900">
        Withdrawal amount
      </label>
      <p className="mt-1 text-sm text-gray-500">You may withdraw up to ${withdrawBalance}.</p>
      <div className="relative mt-2 rounded-md shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-gray-500 sm:text-sm">$</span>
        </div>
        <Input
          type="text"
          id="withdrawal-amount"
          className="block w-full rounded-md border-0 py-2 pl-7 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-600 sm:text-sm sm:leading-6"
          placeholder="0.00"
          aria-describedby="price-currency"
          onChange={(event) => setWithdrawAmount(Number(event.target.value))}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-gray-500 sm:text-sm" id="price-currency">
            USD
          </span>
        </div>
      </div>
    </div>
  )
}

function ConfirmWithdrawal(props: {
  withdrawalMethod?: Stripe.BankAccount | Stripe.Card
  isBank: boolean
  withdrawAmount: number
  complete: boolean
  setComplete: (complete: boolean) => void
}) {
  const { withdrawalMethod, isBank, withdrawAmount, complete, setComplete } = props
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const completeWithdrawal = async () => {
    setIsSubmitting(true)
    setWithdrawError(null)
    try {
      const response = await fetch('/api/stripe-connect-withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dollarAmount: withdrawAmount,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || json?.error) {
        setWithdrawError(
          json?.error ?? 'Withdrawal failed. Please try again or contact info@manifund.org.'
        )
      } else {
        setComplete(true)
      }
    } catch {
      setWithdrawError('Withdrawal failed. Please try again or contact info@manifund.org.')
    }
    setIsSubmitting(false)
  }
  return (
    <>
      {withdrawalMethod ? (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="px-4 py-6 sm:px-6">
            {complete ? (
              <div>
                <Row className="justify-center">
                  <CheckCircleIcon className="h-16 w-16 text-orange-500" />
                </Row>
                <h3 className="text-center text-lg font-semibold leading-7 text-gray-900">
                  Withdrawal complete!
                </h3>
                <p className="mt-1 max-w-2xl text-center text-sm leading-6 text-gray-500">
                  Your payment is on the way. It may take up to 2 business days to process.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold leading-7 text-gray-900">
                  Withdrawal destination and amount confirmation
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Confirm the following details are correct before completing your withdrawal.
                </p>
              </>
            )}
          </div>
          <div className="border-t border-gray-100">
            <dl className="divide-y divide-gray-100">
              <div className="grid grid-cols-2 gap-4 px-6 py-6">
                <dt className=" text-sm font-medium text-gray-900">
                  {isBank ? 'Bank name' : 'Card brand name'}
                </dt>
                <dd className="mt-0 text-sm leading-6 text-gray-700">
                  {isBank
                    ? (withdrawalMethod as Stripe.BankAccount).bank_name
                    : (withdrawalMethod as Stripe.Card).brand}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4 px-6 py-6">
                <dt className=" text-sm font-medium text-gray-900">
                  {isBank
                    ? 'last 4 digits of routing number'
                    : 'last 4 digits of credit card number'}
                </dt>
                <dd className=" mt-0 text-sm leading-6 text-gray-700">
                  {isBank ? '∙∙∙∙∙' : '∙∙∙∙∙∙∙∙∙∙∙∙'}
                  {withdrawalMethod.last4}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4 px-6 py-6">
                <dt className=" text-sm font-medium text-gray-900">Amount to withdraw</dt>
                <dd className="mt-0 text-sm leading-6 text-gray-700">${withdrawAmount}</dd>
              </div>
              {!complete && (
                <div className="px-6 py-6">
                  <Row className="justify-center">
                    <Tooltip
                      text={isSubmitting ? 'Loading...' : complete ? 'Withdrawal complete' : ''}
                    >
                      <Button
                        className="font-semibold"
                        onClick={completeWithdrawal}
                        loading={isSubmitting}
                        disabled={complete}
                      >
                        Withdraw
                      </Button>
                    </Tooltip>
                  </Row>
                  {withdrawError && (
                    <p className="mt-3 text-center text-sm text-rose-600">{withdrawError}</p>
                  )}
                </div>
              )}
            </dl>
          </div>
        </div>
      ) : (
        <div>You need to set up your Stripe account before withdrawing.</div>
      )}
    </>
  )
}
