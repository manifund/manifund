'use client'
import { Tooltip } from '@/components/tooltip'
import {
  ArrowDownTrayIcon,
  ArrowLeftCircleIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/solid'
import { DepositButton } from '@/components/deposit-buttons'
import Link from 'next/link'
import { Button } from '@/components/button'
import { Modal } from '@/components/modal'
import { Dialog } from '@headlessui/react'
import { AmountInput } from '@/components/input'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatMoneyPrecise } from '@/utils/formatting'
import clsx from 'clsx'

// A profile's balances (L5-L12), in About: public, like the rest of the profile. The bar splits the total into
// what can only be donated (charity), what can be withdrawn (cash) and what's promised in pending offers. On your
// own profile, the ways to add, withdraw and move money sit under it.
export function BalanceDisplay(props: {
  balance: number
  cashBalance: number
  charityBalance: number
  pending: number
  accredited: boolean
  isOwnProfile?: boolean
  userId?: string
  regrantor?: boolean
}) {
  const {
    balance,
    cashBalance,
    charityBalance,
    pending,
    accredited,
    isOwnProfile,
    userId,
    regrantor,
  } = props
  const parts = [
    { label: 'Charity', value: charityBalance, dot: 'bg-orange-500', note: 'for donating' },
    { label: 'Cash', value: cashBalance, dot: 'bg-emerald-500', note: 'withdrawable' },
    ...(Math.round(pending) !== 0
      ? [{ label: 'Pending', value: pending, dot: 'bg-amber-300', note: 'in open offers' }]
      : []),
  ]
  const barTotal = parts.reduce((sum, part) => sum + Math.max(part.value, 0), 0)
  const actionClass =
    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-gray-700 transition-colors hover:bg-orange-50 hover:text-orange-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-6 pb-5 pt-5">
        <div>
          <div className="text-[13px] text-gray-500">
            {regrantor ? 'Regranting balance' : 'Balance'}
          </div>
          <div className="mt-1 text-[36px] font-normal leading-none tracking-tight tabular-nums text-gray-900">
            {formatMoneyPrecise(balance)}
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-7 gap-y-2">
          {parts.map((part) => (
            <div key={part.label} title={part.note}>
              <dt className="flex items-center gap-1.5 text-[13px] text-gray-500">
                <span className={clsx('h-2 w-2 rounded-full', part.dot)} aria-hidden />
                {part.label}
              </dt>
              <dd className="mt-0.5 text-[15px] tabular-nums text-gray-900">
                {formatMoneyPrecise(part.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {barTotal > 0 && (
        <div
          className="mx-6 mb-5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-gray-100"
          aria-hidden
        >
          {parts.map((part) =>
            part.value > 0 ? (
              <div
                key={part.label}
                className={part.dot}
                style={{ width: `${(part.value / barTotal) * 100}%` }}
              />
            ) : null
          )}
        </div>
      )}
      {isOwnProfile && userId && (
        <div className="flex flex-wrap gap-1 border-t border-gray-100 px-4 py-2">
          <DepositButton userId={userId}>
            <span className={actionClass}>
              <PlusCircleIcon className="h-4 w-4 text-orange-500" />
              Add funds to charity
            </span>
          </DepositButton>
          <Link href="/withdraw" className={actionClass}>
            <ArrowDownTrayIcon className="h-4 w-4 text-orange-500" />
            Withdraw cash
          </Link>
          {accredited && (
            <a
              href="https://airtable.com/shrIB5yGc56DoQBhJ"
              target="_blank"
              className={actionClass}
            >
              <BanknotesIcon className="h-4 w-4 text-orange-500" />
              Add funds to cash
            </a>
          )}
          {cashBalance > 0 && (
            <CashToCharityButton cashBalance={cashBalance} className={actionClass} />
          )}
        </div>
      )}
    </div>
  )
}

function CashToCharityButton(props: { cashBalance: number; className?: string }) {
  const { cashBalance, className } = props
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [amount, setAmount] = useState<number>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  let errorMessage = null
  if (!amount) {
    errorMessage = 'Please enter an amount.'
  } else if (amount > cashBalance) {
    errorMessage = `Your cash balance is only $${cashBalance}.`
  } else {
    errorMessage = null
  }
  // Leave `confirming` alone on close so the panel doesn't flip back to step one mid-fade
  const close = () => setOpen(false)
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setConfirming(false)
          setOpen(true)
        }}
      >
        <ArrowLeftCircleIcon className="h-4 w-4 text-orange-500" />
        Move cash to charity
      </button>
      <Modal open={open} setOpen={close}>
        {confirming ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" aria-hidden="true" />
            </div>
            <div className="my-3 text-center sm:mt-5">
              <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                Are you sure?
              </Dialog.Title>
              <p className="my-2 text-sm text-gray-500">
                Once money is donated, you can no longer withdraw it. To withdraw instead, click{' '}
                <Link href="/withdraw" className="text-orange-600 underline">
                  here
                </Link>
                .
              </p>
            </div>
            <div className="sm:flex-2 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                color={'gray'}
                className="inline-flex w-full justify-center sm:col-start-1"
                onClick={() => setConfirming(false)}
              >
                Go back
              </Button>
              <Button
                type="button"
                className="sm:flex-2 inline-flex w-full justify-center"
                loading={isSubmitting}
                onClick={async () => {
                  setIsSubmitting(true)
                  await fetch('/api/move-cash-to-charity', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      amount: amount,
                    }),
                  })
                  setIsSubmitting(false)
                  close()
                  router.refresh()
                }}
              >
                Move {formatMoneyPrecise(amount ?? 0)} to charity
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <HeartIcon className="h-6 w-6 text-orange-600" aria-hidden="true" />
            </div>
            <div className="my-3 text-center sm:mt-5">
              <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                Transfer cash balance to charity balance
              </Dialog.Title>
              <p className="my-2 text-sm text-gray-500">
                Do this to donate your funds to other projects rather than withdrawing them.
              </p>
              <label htmlFor="amount">Amount (USD): </label>
              <AmountInput
                step="0.01"
                id="amount"
                autoComplete="off"
                amount={amount}
                onChangeAmount={setAmount}
              />
            </div>
            <div className="sm:flex-2 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                color={'gray'}
                className="inline-flex w-full justify-center sm:col-start-1"
                onClick={close}
              >
                Cancel
              </Button>
              <Tooltip text={errorMessage} placement="top">
                <Button
                  type="button"
                  disabled={errorMessage !== null}
                  className="sm:flex-2 inline-flex w-full justify-center"
                  onClick={() => setConfirming(true)}
                >
                  Transfer money
                </Button>
              </Tooltip>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              This constitutes a donation to Manifold for Charity, a registered 501(c)(3) nonprofit.
              Money in your charity balance has zero monetary value and is not redeemable for cash,
              but can be donated to charity.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
