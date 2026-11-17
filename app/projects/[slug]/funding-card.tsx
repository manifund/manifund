'use client'
import clsx from 'clsx'
import { differenceInDays, differenceInHours } from 'date-fns'
import { DonateBox } from '@/components/donate-box'
import { BidAndProfile } from '@/db/bid'
import type { GivingFund } from '@/db/fund'
import { Profile } from '@/db/profile'
import { FullProject } from '@/db/project'
import { TxnAndProfiles } from '@/db/txn'
import { fundingLeft, usd } from '@/utils/donation-limits'
import { formatMoneyPrecise } from '@/utils/formatting'

// The page's one loud element: where the project stands and how to give to it. Sits in the right
// rail on wide screens and right under the header on narrow ones.
export function FundingCard(props: {
  project: FullProject
  raised: number
  minimum: number
  valuation: number
  projectBids: BidAndProfile[]
  projectTxns: TxnAndProfiles[]
  profile?: Profile
  maxDonation: number
  givingFunds?: GivingFund[]
  setCommentPrompt: (value: string) => void
  pendingTransfer: boolean
}) {
  const { project, raised, minimum, valuation, profile, givingFunds, pendingTransfer } = props
  const isCert = project.type === 'cert'
  const isProposal = project.stage === 'proposal'
  const isOpen = isProposal || project.stage === 'active'
  const goal = project.funding_goal
  const showBar = !isCert && goal > 0 && ['draft', 'proposal', 'active'].includes(project.stage)
  const donors = countDonors(props)
  const left = fundingLeft(goal, raised)
  const canGive = project.type === 'grant' && isOpen && !pendingTransfer && raised < goal

  return (
    <section
      aria-label="Funding"
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200/70"
    >
      {/* Raised, against the goal */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-medium tabular-nums tracking-tight text-gray-900">
          {formatMoneyPrecise(raised)}
        </span>
        {!isCert && goal > 0 && (
          <span className="text-sm text-gray-500">
            {isProposal ? 'offered' : 'raised'} of {formatMoneyPrecise(goal)} goal
          </span>
        )}
        {isCert && <span className="text-sm text-gray-500">raised</span>}
      </div>

      {showBar && <FundingBar raised={raised} minimum={minimum} goal={goal} />}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-gray-500">
        {donors > 0 && (
          <span>
            <span className="tabular-nums text-gray-900">{donors}</span>{' '}
            {donors === 1 ? 'donor' : 'donors'}
          </span>
        )}
        {showBar && minimum > 0 && minimum < goal && (
          <span className={clsx(raised >= minimum && 'text-emerald-700')}>
            <span className={clsx('tabular-nums', raised < minimum && 'text-gray-900')}>
              {usd(minimum)}
            </span>{' '}
            min{raised >= minimum && ' reached'}
          </span>
        )}
        {isProposal && project.auction_close && <TimeLeft closeDate={project.auction_close} />}
        {isCert && (
          <span>
            <span className="tabular-nums text-gray-900">{formatMoneyPrecise(valuation)}</span>{' '}
            {['draft', 'proposal'].includes(project.stage) ? 'minimum valuation' : 'valuation'}
          </span>
        )}
      </div>

      {canGive ? (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <DonateBox
            embedded
            project={project}
            profile={profile}
            maxDonation={props.maxDonation}
            fundingLeft={left}
            setCommentPrompt={props.setCommentPrompt}
            givingFunds={givingFunds}
          />
        </div>
      ) : (
        project.type === 'grant' && (
          <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
            {closedNote(project.stage, pendingTransfer, raised >= goal)}
          </p>
        )
      )}
    </section>
  )
}

// Orange to what's raised; a tick at the minimum while it's still ahead, since a proposal only
// goes ahead once it reaches it.
function FundingBar(props: { raised: number; minimum: number; goal: number }) {
  const { raised, minimum, goal } = props
  const pct = Math.min((raised / goal) * 100, 100)
  const minPct = Math.min((minimum / goal) * 100, 100)
  const showMin = minimum > 0 && minimum < goal
  const reachedMin = raised >= minimum
  return (
    <div className="mt-4">
      <div
        className="relative h-2 rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={raised}
        aria-label="Funding progress"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-orange-500"
          style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
        />
        {showMin && !reachedMin && (
          <div
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-gray-400"
            style={{ left: `${minPct}%` }}
          />
        )}
      </div>
    </div>
  )
}

function TimeLeft(props: { closeDate: string }) {
  // Closes at midnight Pacific, as TimeLeftDisplay
  const close = new Date(`${props.closeDate}T23:59:59-07:00`)
  const now = new Date()
  const days = differenceInDays(close, now)
  const hours = Math.max(differenceInHours(close, now), 0)
  return (
    <span suppressHydrationWarning>
      {days >= 1 ? (
        <>
          <span className="tabular-nums text-gray-900">{days}</span> {days === 1 ? 'day' : 'days'}{' '}
          left
        </>
      ) : hours > 0 ? (
        <>
          <span className="tabular-nums text-gray-900">{hours}</span> hours left
        </>
      ) : (
        'Closing today'
      )}
    </span>
  )
}

function countDonors(props: {
  project: FullProject
  projectBids: BidAndProfile[]
  projectTxns: TxnAndProfiles[]
}) {
  const { project, projectBids, projectTxns } = props
  const ids =
    project.stage === 'proposal'
      ? projectBids
          .filter((b) => b.type === 'donate' && b.status === 'pending')
          .map((b) => b.bidder)
      : projectTxns
          .filter((t) => t.type === 'project donation' && t.from_id)
          .map((t) => t.from_id as string)
  return new Set(ids).size
}

function closedNote(stage: FullProject['stage'], pendingTransfer: boolean, funded: boolean) {
  if (pendingTransfer) return 'Donations open once this grant is transferred to its recipient.'
  if (stage === 'draft') return 'Donations open once the project is published.'
  if (stage === 'complete') return 'This project is complete and no longer taking donations.'
  if (stage === 'not funded') return 'This proposal closed without reaching its minimum.'
  if (funded) return 'Fully funded and not currently taking donations.'
  return 'Not currently taking donations.'
}
