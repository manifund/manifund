'use client'
import { Button } from '@/components/button'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { UserAvatarAndBadge } from '@/components/user-link'
import { BidAndProfile, deleteBid } from '@/db/bid'
import { Project, TOTAL_SHARES } from '@/db/project'
import { formatLargeNumber, formatMoney } from '@/utils/formatting'
import { Dialog } from '@headlessui/react'
import { CircleStackIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Slider } from '@/components/slider'
import { AmountInput, Checkbox } from '@/components/input'
import { useSupabase } from '@/db/supabase-provider'
import { Modal } from '@/components/modal'
import { Profile } from '@/db/profile'
import { Avatar } from '@/components/avatar'
import { RelativeTime } from '@/components/relative-time'

export function Bids(props: {
  bids: BidAndProfile[]
  project: Project
  userSpendableFunds: number
  userSellableShares: number
  userProfile?: Profile
  activeAuction?: boolean
}) {
  const { bids, project, userSpendableFunds, userSellableShares, userProfile, activeAuction } =
    props
  if (bids.length === 0)
    return <p className="text-center italic text-gray-500">There are no bids on this project.</p>
  const buyBids = bids.filter((bid) => bid.type === 'buy' || bid.type === 'assurance buy')
  const sellBids = bids.filter((bid) => bid.type === 'sell')
  const donateBids = bids.filter((bid) => bid.type === 'donate')
  return (
    <Row className="w-full justify-center">
      <div className="flex w-full flex-col">
        <Col>
          {buyBids.length !== 0 && <h1 className="text-xl">Buy Offers</h1>}
          {buyBids.map((bid) => (
            <Bid
              key={bid.id}
              bid={bid}
              project={project}
              userProfile={userProfile}
              showValuation={!activeAuction}
              userSellableShares={userSellableShares}
              userSpendableFunds={userSpendableFunds}
            />
          ))}
        </Col>
        <Col>
          {sellBids.length !== 0 && <h1 className="text-xl">Sell Offers</h1>}
          {sellBids.map((bid) => (
            <Bid
              key={bid.id}
              bid={bid}
              userProfile={userProfile}
              project={project}
              showValuation={true}
              userSellableShares={userSellableShares}
              userSpendableFunds={userSpendableFunds}
            />
          ))}
        </Col>
        <Col>
          {donateBids.length !== 0 && <h1 className="text-xl">Donation Offers</h1>}
          {donateBids.map((bid) => (
            <Bid
              key={bid.id}
              bid={bid}
              project={project}
              userProfile={userProfile}
              showValuation={false}
            />
          ))}
        </Col>
      </div>
    </Row>
  )
}

export function Bid(props: {
  bid: BidAndProfile
  showValuation: boolean
  project?: Project
  userProfile?: Profile
  userSpendableFunds?: number
  userSellableShares?: number
}) {
  const { bid, showValuation, project, userProfile, userSpendableFunds, userSellableShares } = props
  const showTrade =
    userProfile &&
    bid.bidder !== userProfile.id &&
    bid.type !== 'assurance buy' &&
    bid.type !== 'donate'
  return (
    <div className="grid w-full grid-cols-3 items-center gap-3 rounded p-3 text-sm hover:bg-gray-200">
      <Row className="justify-start">
        <UserAvatarAndBadge profile={bid.profiles} />
      </Row>
      <Row className="items-center justify-end">
        {showValuation ? (
          <div>
            {formatMoney(bid.amount)} <span className="text-gray-500"> @ </span>
            {formatMoney(bid.valuation)}
            <span className="text-gray-500"> valuation</span>
          </div>
        ) : (
          <div>{formatMoney(bid.amount)}</div>
        )}
      </Row>
      <Row className="items-center justify-end gap-2">
        <RelativeTime
          date={bid.created_at}
          className="hidden text-right text-gray-500 sm:block"
        />
        {userProfile && bid.bidder === userProfile.id && <DeleteBid bidId={bid.id} />}
        {showTrade && project && (
          <Trade
            bid={bid}
            project={project}
            userId={userProfile.id}
            userSpendableFunds={userSpendableFunds ?? 0}
            userSellableShares={userSellableShares ?? 0}
          />
        )}
      </Row>
    </div>
  )
}

function Trade(props: {
  bid: BidAndProfile
  project: Project
  userId: string
  userSpendableFunds: number
  userSellableShares: number
}) {
  const { bid, project, userId, userSpendableFunds, userSellableShares } = props
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const userSellableValue = (userSellableShares / TOTAL_SHARES) * bid.valuation
  const [tradeAmount, setTradeAmount] = useState<number | undefined>(
    Math.min(bid.type === 'buy' ? userSellableValue : userSpendableFunds, bid.amount)
  )
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const enoughMoney = !!tradeAmount && tradeAmount <= (userSpendableFunds ?? 0)
  const enoughShares =
    ((tradeAmount ?? 0) / bid.valuation) * TOTAL_SHARES <= (userSellableShares ?? 0)
  const marks = [
    { value: 0, label: '$0' },
    { value: 25, label: `${formatMoney(bid.amount / 4)}` },
    { value: 50, label: `${formatMoney(bid.amount / 2)}` },
    { value: 75, label: `${formatMoney((bid.amount / 4) * 3)}` },
    { value: 100, label: `${formatMoney(bid.amount)}` },
  ]
  const router = useRouter()

  let errorMessage: string | null = null
  if (bid.type === 'buy' && !enoughShares) {
    errorMessage = `You don't hold enough equity to make this trade. If all of the sell offers you have already placed are accepted, you will only have ${formatLargeNumber(
      (userSellableShares / TOTAL_SHARES) * 100
    )}% left.`
  } else if (bid.type === 'sell' && !enoughMoney) {
    errorMessage = `You don't have enough funds to make this trade. If all of the buy bids you have already placed are accepted, you will only have ${formatMoney(
      userSpendableFunds
    )} left.`
  } else if (!tradeAmount || tradeAmount <= 0) {
    errorMessage = `You must trade over $0.`
  } else if (tradeAmount > bid.amount) {
    errorMessage = `You can only trade up to the amount offered: ${formatLargeNumber(
      (tradeAmount / bid.valuation) * 100
    )}% for ${formatMoney(tradeAmount)}.`
  } else if (!agreedToTerms && project.creator === userId && bid.type === 'buy') {
    errorMessage = `Confirm that you understand the terms of this trade.`
  }
  return (
    <div>
      <Button
        className="w-14 text-xs"
        onClick={() => {
          setOpen(true)
        }}
        disabled={
          (bid.type === 'sell' && userSpendableFunds === 0) ||
          (bid.type === 'buy' && userSellableShares === 0)
        }
      >
        {bid.type === 'buy' ? 'Sell' : 'Buy'}
      </Button>
      <Modal open={open} setOpen={setOpen}>
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <CircleStackIcon className="h-6 w-6 text-orange-600" aria-hidden="true" />
          </div>
          <div className="mt-3 text-center sm:mt-5">
            <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
              Select trade amount
            </Dialog.Title>
            <div className="mt-2">
              <p className="text-sm text-gray-500">Choose what portion of this offer to accept.</p>
            </div>
            <div className="mt-5 flex justify-center">
              <div className="flex w-11/12 justify-center gap-2">
                <p className="relative top-3">$</p>
                <AmountInput
                  className="w-1/3"
                  amount={tradeAmount}
                  onChangeAmount={setTradeAmount}
                />
                <Slider
                  marks={marks}
                  amount={((tradeAmount ?? 0) / bid.amount) * 100}
                  onChange={(value) => setTradeAmount(((value as number) * bid.amount) / 100)}
                  step={5}
                />
              </div>
            </div>
            {project.creator === userId && (
              <div className="mb-3 flex">
                <Checkbox
                  id="terms"
                  aria-describedby="terms-description"
                  name="terms"
                  checked={agreedToTerms}
                  onChange={() => setAgreedToTerms(!agreedToTerms)}
                />
                <div className="ml-3 text-sm leading-6">
                  <label htmlFor="terms" className="font-medium text-gray-900">
                    I understand
                  </label>{' '}
                  <span id="terms-description" className="text-gray-500">
                    <span className="sr-only">I understand </span>that by making this trade, I am
                    agreeing to pay {formatLargeNumber(((tradeAmount ?? 0) / bid.valuation) * 100)}%
                    of any prize money this project wins to Manifund, which will be distributed to
                    the investor who holds these shares.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-center text-red-500">{errorMessage}</div>
        <div className="sm:flex-2 mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
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
            loading={isSubmitting}
            disabled={errorMessage !== null}
            onClick={async () => {
              setIsSubmitting(true)
              const response = await fetch('/api/trade-with-limit', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  oldBidId: bid.id,
                  numDollarsInTrade: tradeAmount,
                }),
              })
              const res = await response.json()
              setIsSubmitting(false)
              setOpen(false)
              router.refresh()
            }}
          >
            {`${bid.type === 'buy' ? 'Sell' : 'Buy'} ${formatLargeNumber(
              ((tradeAmount ?? 0) / bid.valuation) * 100
            )}% for ${formatMoney(tradeAmount ?? 0)}`}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function DeleteBid(props: { bidId: string }) {
  const { bidId } = props
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { supabase } = useSupabase()
  const router = useRouter()
  return (
    <div>
      <Button
        className="w-14 bg-rose-500 text-xs hover:bg-rose-600"
        onClick={() => {
          setOpen(true)
        }}
      >
        Delete
      </Button>
      <Modal open={open} setOpen={setOpen}>
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <TrashIcon className="h-6 w-6 text-rose-600" aria-hidden="true" />
          </div>
          <div className="mt-3 text-center sm:mt-5">
            <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
              Are you sure you want to delete this offer?
            </Dialog.Title>
          </div>
        </div>
        <div className="sm:flex-2 mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row">
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
            className="sm:flex-2 inline-flex w-full justify-center bg-rose-500 hover:bg-rose-600"
            loading={isSubmitting}
            onClick={async () => {
              await deleteBid(supabase, bidId)
              setIsSubmitting(false)
              setOpen(false)
              router.refresh()
            }}
          >
            Delete offer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
