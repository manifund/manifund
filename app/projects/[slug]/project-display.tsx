'use client'
import { AiTrophy } from '@/components/ai-trophy'
import { BidAndProfile, BidAndProject } from '@/db/bid'
import { Profile } from '@/db/profile'
import { FullProject, Project } from '@/db/project'
import { Cause, SimpleCause } from '@/db/cause'
import { TxnAndProfiles, TxnAndProject } from '@/db/txn'
import {
  calculateCashBalance,
  getAmountRaised,
  getMinIncludingAmm,
  getProjectValuation,
} from '@/utils/math'
import { useState } from 'react'
import { isHighlyRatedByAi, karmaWeight } from '@/utils/karma'
import { CommentPromptProvider, useCommentPrompt } from './comment-prompt'
import { getViewerFunds } from './viewer-funds'
import { ProposalRequirements } from './proposal-requirements'
import { ProjectTimeline } from './project-timeline'
import { VoteKarma } from './vote'
import { CauseTag } from '@/components/tags'
import { NetworkLine } from '@/components/follows/network-tag'
import type { NetworkItem } from '@/lib/follows/network'
import type { GivingFund } from '@/db/fund'
import { Trade } from './trade'
import { AssuranceBuyBox } from './assurance-buy-box'
import { calculateTradePoints } from '@/utils/amm'
import { CertValuationChart } from './valuation-chart'
import { RichContent } from '@/components/editor'
import { ProjectActions } from './project-actions'
import { AdminBanner } from './admin-banner'
import { FundingCard } from './funding-card'
import { OutlineSectionsProvider, ProjectOutline } from './project-outline'
import clsx from 'clsx'
import { UserAvatarAndBadge } from '@/components/user-link'
import { ProjectScoreFlags } from '@/components/slop-flag'
import { formatDateUtc, toSentenceCase } from '@/utils/formatting'
import Link from 'next/link'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

type ProjectDisplayProps = {
  project: FullProject
  userTxns: TxnAndProject[]
  userBids: BidAndProject[]
  projectBids: BidAndProfile[]
  projectTxns: TxnAndProfiles[]
  causesList: SimpleCause[]
  prizeCause?: Cause
  userProfile?: Profile
  creatorEmail?: string
  userIsAdmin?: boolean
  network?: NetworkItem[] // what people the viewer follows did here (F8)
  givingFunds?: GivingFund[] // funds the viewer can give as (F2)
  // The tabs (comments, offers, similar projects), rendered by the page and streamed in later.
  tabs: React.ReactNode
}

export function ProjectDisplay(props: ProjectDisplayProps) {
  return (
    <CommentPromptProvider>
      <OutlineSectionsProvider>
        <ProjectDisplayInner {...props} />
      </OutlineSectionsProvider>
    </CommentPromptProvider>
  )
}

function ProjectDisplayInner(props: ProjectDisplayProps) {
  const {
    project,
    userTxns,
    userBids,
    projectBids,
    projectTxns,
    userProfile,
    creatorEmail,
    causesList,
    prizeCause,
    userIsAdmin,
    givingFunds,
    tabs,
  } = props
  const { userSpendableFunds, userSellableShares } = getViewerFunds(
    project,
    userProfile,
    userTxns,
    userBids
  )
  const valuation = getProjectValuation(project)
  const isOwnProject = userProfile?.id === project.profiles.id
  const pendingProjectTransfers = project.project_transfers?.filter(
    (projectTransfer) => !projectTransfer.transferred
  )
  const userIsFollower =
    !!userProfile &&
    !!project.project_follows.find((follow) => follow.follower_id === userProfile.id)
  const amountRaised = getAmountRaised(project, projectBids, projectTxns)
  const minIncludingAmm = getMinIncludingAmm(project)
  const tradePoints = calculateTradePoints(projectTxns, project.id)
  // userTxns/userBids belong to the viewer, so this is only the creator's when it's their project.
  const creatorCashBalance =
    userProfile && isOwnProject
      ? calculateCashBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
      : 0
  const showExpandedTimeline =
    isOwnProject &&
    project.type === 'grant' &&
    ['draft', 'proposal', 'active'].includes(project.stage) &&
    pendingProjectTransfers.length === 0
  const activeAuction = !!prizeCause?.cert_params?.auction && project.stage === 'proposal'
  const { setPrompt: setSpecialCommentPrompt } = useCommentPrompt()
  // The viewer's vote is held here so the counts and karma move at once; their weight
  // is known client-side. Refreshed server data already includes the vote.
  const savedMagnitude =
    project.project_votes.find((v) => v.voter_id === userProfile?.id)?.magnitude ?? 0
  const [newMagnitude, setNewMagnitude] = useState<number | null>(null)
  const myMagnitude = newMagnitude ?? savedMagnitude
  const voteWeight =
    userProfile && userProfile.id !== project.creator ? karmaWeight(userProfile.karma) : 0
  const karmaDelta = (myMagnitude - savedMagnitude) * voteWeight
  const pendingTransfer = pendingProjectTransfers.length > 0
  const isCert = project.type === 'cert'
  return (
    <div className="pb-16 pt-2 font-light">
      {userIsAdmin && (
        <AdminBanner project={project} projectBids={projectBids} projectTxns={projectTxns} />
      )}
      {showExpandedTimeline ? (
        <ProjectTimeline
          projectSlug={project.slug}
          stage={project.stage}
          signedAgreement={project.signed_agreement}
          approved={project.approved === true}
          reachedMinFunding={amountRaised >= minIncludingAmm}
          minFunding={minIncludingAmm}
          withdrawComplete={project.stage === 'active' && creatorCashBalance <= 0}
        />
      ) : (
        project.stage === 'proposal' &&
        !pendingTransfer && (
          <ProposalRequirements
            signedAgreement={project.signed_agreement}
            approved={project.approved === true}
            reachedMinFunding={amountRaised >= minIncludingAmm}
            projectSlug={project.slug}
          />
        )
      )}
      {/* One column on narrow screens (header, funding, body); from xl the funding card and the
          outline move to a sticky rail beside the header and body. */}
      <div className="grid grid-cols-1 gap-y-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-x-12">
        <header className="flex flex-col gap-4 xl:col-start-1 xl:row-start-1">
          <ProjectScoreFlags
            aiFraction={project.ai_fraction}
            qualityScore={project.quality_score}
          />
          {/* above the title, the way feeds put "reposted by" above a post (F8) */}
          <NetworkLine items={props.network} size="sm" />
          <div className="flex gap-2 sm:gap-3">
            <div className="-ml-3 pt-0.5 sm:-ml-2">
              <VoteKarma
                projectId={project.id}
                userId={userProfile?.id}
                isCreator={isOwnProject}
                karma={project.karma + karmaDelta}
                breakdown={project.karma_breakdown}
                magnitude={myMagnitude}
                setMagnitude={setNewMagnitude}
                setCommentPrompt={setSpecialCommentPrompt}
                weight={voteWeight}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-balance text-2xl font-medium leading-tight tracking-tight text-gray-900 sm:text-[32px] sm:leading-[1.15]">
                {project.title}
                {isHighlyRatedByAi(project.project_ai_evals) && (
                  <AiTrophy href="#ai-review" className="ml-2 inline-block align-middle" />
                )}
              </h1>
              {project.blurb && (
                <p className="mt-2 max-w-[640px] text-pretty text-base leading-normal text-gray-600 sm:text-lg">
                  {project.blurb}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <StagePill stage={project.stage} />
                {isCert && (
                  <Link
                    href="/about/impact-certificates"
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 text-xs leading-5 text-gray-700 hover:bg-gray-200"
                  >
                    <ArrowTrendingUpIcon className="h-3 w-3" />
                    Impact certificate
                  </Link>
                )}
                {project.causes?.map((cause) => (
                  <CauseTag key={cause.slug} causeTitle={cause.title} causeSlug={cause.slug} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-200 pb-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
              <UserAvatarAndBadge profile={project.profiles} />
              <time dateTime={project.created_at} className="text-gray-500">
                {formatDateUtc(project.created_at, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
              {pendingTransfer && (
                <span className="text-gray-500">
                  pending transfer to {pendingProjectTransfers[0].recipient_name}
                </span>
              )}
            </div>
            <ProjectActions
              project={project}
              causesList={causesList}
              prizeCause={prizeCause}
              signedIn={!!userProfile}
              isOwner={isOwnProject}
              isAdmin={!!userIsAdmin}
              following={userIsFollower}
              creatorEmail={creatorEmail}
            />
          </div>
        </header>

        <aside className="flex max-w-[680px] flex-col gap-8 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto xl:pb-2">
          <FundingCard
            project={project}
            raised={amountRaised}
            minimum={minIncludingAmm}
            valuation={valuation}
            projectBids={projectBids}
            projectTxns={projectTxns}
            profile={userProfile}
            maxDonation={userSpendableFunds}
            givingFunds={givingFunds}
            setCommentPrompt={setSpecialCommentPrompt}
            pendingTransfer={pendingTransfer}
          />
          <div className="hidden xl:block">
            <ProjectOutline containerId="project-description" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-10 xl:col-start-1 xl:row-start-2">
          {isCert && (
            <CertPanels
              project={project}
              projectTxns={projectTxns}
              tradePoints={tradePoints}
              valuation={valuation}
              minIncludingAmm={minIncludingAmm}
              amountRaised={amountRaised}
              activeAuction={activeAuction}
              userProfile={userProfile}
              userSpendableFunds={userSpendableFunds}
              userSellableShares={userSellableShares}
            />
          )}
          {project.description && (
            <div id="project-description">
              <RichContent
                content={project.description}
                className="max-w-[680px] text-[15px] leading-7 text-gray-800 sm:text-base sm:leading-[1.75] prose-headings:font-medium prose-headings:tracking-tight prose-headings:text-gray-900 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg"
              />
            </div>
          )}
          <div id="tabs" className="scroll-mt-0">
            {tabs}
          </div>
        </div>
      </div>
    </div>
  )
}

// Stage as a small dot-and-word pill: the color says whether the project is taking money.
const STAGE_DOT: Record<Project['stage'], string> = {
  proposal: 'bg-amber-500',
  active: 'bg-emerald-500',
  complete: 'bg-gray-400',
  'not funded': 'bg-rose-400',
  draft: 'bg-gray-300',
  hidden: 'bg-gray-300',
}
function StagePill(props: { stage: Project['stage'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 text-xs leading-5 text-gray-700 ring-1 ring-gray-200">
      <span className={clsx('h-1.5 w-1.5 rounded-full', STAGE_DOT[props.stage])} aria-hidden />
      {toSentenceCase(props.stage)}
    </span>
  )
}

// Impact certificates are rare now: their chart and trading boxes stay as they were, in the column.
function CertPanels(props: {
  project: FullProject
  projectTxns: TxnAndProfiles[]
  tradePoints: ReturnType<typeof calculateTradePoints>
  valuation: number
  minIncludingAmm: number
  amountRaised: number
  activeAuction: boolean
  userProfile?: Profile
  userSpendableFunds: number
  userSellableShares: number
}) {
  const { project, projectTxns, valuation, minIncludingAmm, amountRaised, activeAuction } = props
  const ammTxns = projectTxns.filter(
    (txn) => txn.to_id === project.id || txn.from_id === project.id
  )
  return (
    <div className="flex flex-col gap-6">
      {!['draft', 'proposal'].includes(project.stage) && !!project.amm_shares && (
        <CertValuationChart
          tradePoints={props.tradePoints}
          ammTxns={ammTxns}
          ammId={project.id}
          size="lg"
        />
      )}
      {(project.stage === 'active' || project.stage === 'complete') && (
        <Trade
          ammTxns={project.amm_shares ? ammTxns : undefined}
          projectId={project.id}
          userSpendableFunds={props.userSpendableFunds}
          userSellableShares={props.userSellableShares}
          signedIn={!!props.userProfile}
        />
      )}
      {props.userProfile?.id !== project.creator && project.stage === 'proposal' && (
        <AssuranceBuyBox
          project={project}
          minValuation={valuation}
          offerSizePortion={
            (activeAuction ? minIncludingAmm : minIncludingAmm - amountRaised) / valuation
          }
          maxBuy={props.userSpendableFunds}
          activeAuction={activeAuction}
          signedIn={!!props.userProfile}
        />
      )}
    </div>
  )
}

// After a vote or donation, bring the comment box into view to ask why.
export function scrollToComments() {
  document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
