'use client'
import { Profile } from '@/db/profile'
import { Dialog } from '@headlessui/react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReactNode, useState } from 'react'
import { Button } from './button'
import { AmountInput } from './input'
import { Modal } from './modal'
import { SiteLink } from './site-link'
import { Tabs } from './tabs'
import Link from 'next/link'
import AlertBox from './alert-box'

export function DepositButton(props: {
  userId: string
  children?: ReactNode
  passFundsTo?: Profile
}) {
  const { userId, children, passFundsTo } = props
  const [open, setOpen] = useState(false)
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const currentTabId = searchParams.get('tab')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {children}
      </button>
      <Modal open={open} setOpen={setOpen}>
        <div className="flex justify-end">
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none"
            onClick={() => setOpen(false)}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {passFundsTo ? (
          <DonateTab userId={userId} setOpen={setOpen} passFundsTo={passFundsTo} />
        ) : (
          <Tabs
            tabs={[
              {
                name: 'Credit card',
                id: 'donate',
                display: <DonateTab userId={userId} setOpen={setOpen} />,
              },
              {
                name: 'Wire, crypto, DAF',
                id: 'wire',
                display: <WireTab />,
              },
            ]}
            currentTabId={currentTabId}
          />
        )}
      </Modal>
    </>
  )
}

function WireTab() {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold leading-6 text-gray-900">Large transfers</h3>
      <p className="text-sm text-gray-500">
        For large donations ($10k+), we accept transfers via wire/ACH, crypto, or a donor advised
        fund.
      </p>
      <ol className="list-inside list-decimal space-y-2 text-sm text-gray-600">
        <li>
          Fill out{' '}
          <SiteLink
            href="https://airtable.com/appOfJtzt8yUTBFcD/pagKKSjAXCUkwUikk/form"
            className="text-blue-600 hover:underline"
          >
            this form
          </SiteLink>{' '}
          to register your donation
        </li>
        <li>
          Follow payment instructions on{' '}
          <SiteLink
            href="https://manifoldmarkets.notion.site/Manifund-Deposit-via-DAF-ACH-wire-or-crypto-02aee92e884a47e49efd4d93242e2080"
            className="text-blue-600 hover:underline"
          >
            this page
          </SiteLink>
        </li>
        <li>
          We&apos;ll update your Manifund balance upon receiving your donation (typically 1-5 days
          for wire/ACH/crypto, and longer for DAFs)
        </li>
      </ol>
    </div>
  )
}

function DonateTab(props: {
  userId: string
  setOpen: (value: boolean) => void
  passFundsTo?: Profile
}) {
  const { userId, setOpen, passFundsTo } = props
  const router = useRouter()
  const [amount, setAmount] = useState<number | undefined>(100)
  const [isSubmitting, setIsSubmitting] = useState(false)
  let errorMessage = null
  if (!amount || amount < 10) {
    errorMessage = 'Minimum deposit is $10.'
  }
  if (amount && amount > 50000) {
    errorMessage = 'Credit card donations are capped at $50,000.'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mt-3 sm:mt-5">
        <Dialog.Title as="h3" className="mb-1 text-base font-semibold leading-6 text-gray-900">
          {passFundsTo
            ? `Send money to ${passFundsTo.full_name}`
            : 'Add funds to your Manifund account'}
        </Dialog.Title>
        {!passFundsTo && (
          <p className="my-2 text-sm text-gray-500">
            This money will go into your charity balance, which can be donated but not withdrawn.
          </p>
        )}
        <label htmlFor="amount">$ </label>
        <AmountInput step="0.01" id="amount" amount={amount} onChangeAmount={setAmount} />
        {/* Show an alert box if the user is trying to donate $10k or more */}
        {amount && amount >= 10000 && (
          <AlertBox title="Large donations" type="warning">
            For donations of $10,000+, consider{' '}
            <Link
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:underline hover:decoration-orange-500 hover:decoration-2"
              href="https://manifoldmarkets.notion.site/Donations-via-DAF-wire-ACH-crypto-02aee92e884a47e49efd4d93242e2080?pvs=4"
            >
              using a DAF, bank transfer, or crypto
              <ArrowTopRightOnSquareIcon className="inline h-4 w-4" />
            </Link>{' '}
            for lower fees.
          </AlertBox>
        )}
      </div>
      {errorMessage && <AlertBox title={errorMessage} type="error" />}
      <div className="sm:flex-2 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          color={'gray'}
          className="inline-flex w-full justify-center sm:col-start-1"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="sm:flex-2 inline-flex w-full justify-center"
          disabled={errorMessage !== null}
          loading={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true)
            const response = await fetch('/api/checkout-sessions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                dollarQuantity: amount,
                userId,
                passFundsToId: passFundsTo?.id,
              }),
            })
            const json = await response.json()
            setIsSubmitting(false)
            router.push(json.url)
          }}
        >
          Checkout
        </Button>
      </div>
      <p className="mt-4 text-xs font-light text-gray-500">
        Your purchase constitutes a donation to Manifold for Charity, a registered 501(c)(3)
        nonprofit.{' '}
        {passFundsTo
          ? ''
          : 'Money in your charity balance has zero monetary value and is not redeemable for cash, but can be donated to charity.'}
      </p>
    </div>
  )
}
