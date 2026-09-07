import {
  ArrowRightIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  HashtagIcon,
} from '@heroicons/react/20/solid'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Stripe from 'stripe'
import { Card } from './layout/card'
import { FeatureCard } from './feature-card'
import { Col } from './layout/col'
import { Row } from './layout/row'
import { MERCURY_ENABLED } from '@/utils/constants'

export type AccountStatus = 'nonexistent' | 'incomplete' | 'complete'

// Falls back to the old Airtable form while MERCURY_ENABLED is off, so the new
// flow can ship dark and be tested in production before anyone is sent to it.
const LARGE_WITHDRAWAL_URL = MERCURY_ENABLED
  ? '/withdraw/request'
  : 'https://airtable.com/shrI3XFPivduhbnGa'
const LARGE_WITHDRAWAL_DESCRIPTION = MERCURY_ENABLED
  ? 'Enter your bank details with Mercury, our bank, and receive money within 4 business days.'
  : 'Fill out our manual withdraw form with your bank account details and we will manually send you money within 5 business days.'

export function WithdrawalDetails(props: {
  accountStatus: AccountStatus
  userId: string
  withdrawalMethod?: Stripe.BankAccount | Stripe.Card | null
  loginUrl?: string
}) {
  const { accountStatus, withdrawalMethod, userId, loginUrl } = props
  const router = useRouter()
  if (accountStatus !== 'complete') {
    return (
      <>
        <h1 className="text-center text-xl font-semibold text-gray-900">Withdrawals not enabled</h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          {accountStatus === 'nonexistent' ? 'Set up' : 'Finish setting up'} your Stripe connect
          account to enable withdrawals
          {MERCURY_ENABLED
            ? ', or withdraw straight to your bank.'
            : ', or fill out our manual withdraw form.'}
        </p>
        <div className="mt-5 flex w-full flex-col gap-4 sm:flex-row">
          <button
            className="h-full flex-1 text-left"
            onClick={async () => {
              if (!loginUrl) {
                const response = await fetch('/api/create-connect-account', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    profileId: userId,
                  }),
                })
                const json = await response.json()
                router.push(json.url)
              } else {
                router.push(loginUrl)
              }
            }}
          >
            <FeatureCard
              icon={<div className="mx-1 text-xl">🇺🇸</div>}
              title="Small & US"
              description="Set up your Stripe connect account to withdraw funds on demand. Funds will be sent to your bank account within 2 business days. (Only available in the United States, for withdrawals up to $10,000.)"
              url={loginUrl}
              linkText={
                accountStatus === 'nonexistent' ? 'Set up account' : 'Finish setting up account'
              }
            />
          </button>
          <div className="h-full flex-1">
            <FeatureCard
              icon={<div className="mx-1 text-xl">🌍</div>}
              title="Large or international"
              description={LARGE_WITHDRAWAL_DESCRIPTION}
              url={LARGE_WITHDRAWAL_URL}
              linkText={MERCURY_ENABLED ? 'Withdraw to your bank' : 'Go to form'}
            />
          </div>
        </div>
      </>
    )
  }
  if (!withdrawalMethod) {
    throw new Error('No withdrawal method')
  }
  const isBank = withdrawalMethod.object === 'bank_account'
  return (
    <Col className="ph-no-capture gap-10">
      <Link
        href={LARGE_WITHDRAWAL_URL}
        className="rounded-md bg-orange-500 p-3 text-sm font-semibold text-white shadow hover:bg-orange-600"
      >
        <Row className="items-center justify-between">
          Withdrawals larger than $10,000
          <ArrowRightIcon className="h-6 w-6 text-white" aria-hidden="true" />
        </Row>
      </Link>
      <Card>
        <div className="lg:col-start-3 lg:row-end-1">
          <h2 className="sr-only">{isBank ? 'Bank details' : 'Card details'}</h2>
          <dl className="flex flex-wrap">
            <div className="flex-auto pl-3 pt-3">
              <dt className="text-lg font-semibold leading-6 text-gray-900">
                {isBank ? 'Bank details' : 'Card details'}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-gray-500">
                This is where your funds will be sent when you withdraw.
              </dd>
            </div>
            <div className="self-end px-3 pt-3">
              {isBank ? (
                <BuildingLibraryIcon className="h-16 w-16 text-gray-400" aria-hidden="true" />
              ) : (
                <CreditCardIcon className="h-16 w-16 text-gray-400" aria-hidden="true" />
              )}
            </div>
            <Row className="mt-4 w-full flex-none gap-x-4 px-6">
              <dt className="flex-none">
                <span className="sr-only">{isBank ? 'bank name' : 'brand name'}</span>
                {isBank ? (
                  <BuildingLibraryIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                ) : (
                  <CreditCardIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                )}
              </dt>
              <dd className="text-sm leading-6 text-gray-500">
                {isBank
                  ? (withdrawalMethod as Stripe.BankAccount).bank_name
                  : (withdrawalMethod as Stripe.Card).brand}
              </dd>
            </Row>
            <Row className="mt-4 w-full flex-none gap-x-4 px-6">
              <dt className="flex-none">
                <span className="sr-only">
                  {isBank
                    ? 'last 4 digits of routing number'
                    : 'last 4 digits of credit card number'}
                </span>
                <HashtagIcon className="h-6 w-5 text-gray-400" aria-hidden="true" />
              </dt>
              <dd className="text-sm leading-6 text-gray-500">
                <p>
                  {isBank ? '∙∙∙∙∙' : '∙∙∙∙∙∙∙∙∙∙∙∙'}
                  {withdrawalMethod.last4}
                </p>
              </dd>
            </Row>
          </dl>
          <div className="mt-6 border-t border-gray-900/5 px-3 pb-2 pt-5">
            <a
              href={`${loginUrl}#settings`}
              className="text-sm font-semibold leading-6 text-gray-900"
            >
              Edit details <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </Card>
    </Col>
  )
}
