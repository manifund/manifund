'use client'
import { Karma } from '@/components/karma'
import { AiTrophy } from '@/components/ai-trophy'
import { DonateBox } from '@/components/donate-box'
import { fundingLeft } from '@/utils/donation-limits'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { ProgressBar } from '@/components/progress-bar'
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
import { countVotes } from '@/utils/sort'
import { CommentPromptProvider, useCommentPrompt } from './comment-prompt'
import { getViewerFunds } from './viewer-funds'
import { ProjectData } from './project-data'
import { ProposalRequirements } from './proposal-requirements'
import { ProjectTimeline } from './project-timeline'
import { Vote } from './vote'
import { CauseTag, StageIcon } from '@/components/tags'
import { NetworkLine } from '@/components/follows/network-tag'
import type { NetworkItem } from '@/lib/follows/network'
import { Trade } from './trade'
import { AssuranceBuyBox } from './assurance-buy-box'
import { calculateTradePoints } from '@/utils/amm'
import { CertValuationChart } from './valuation-chart'
import { RichContent } from '@/components/editor'
import { CreatorActionPanel } from './creator-action-panel'
import { AdminActionPanel } from './admin-action-panel'
import { UserAvatarAndBadge } from '@/components/user-link'
import { Tooltip } from '@/components/tooltip'
import { EnvelopeIcon } from '@heroicons/react/20/solid'
import { ViewerActionPanel } from './viewer-action-panel'
import { ProjectScoreFlags } from '@/components/slop-flag'
import { formatDateUtc, toSentenceCase } from '@/utils/formatting'
import Link from 'next/link'
import { ArrowTrendingUpIcon, CircleStackIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

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
  // The tabs (comments, offers, similar projects), rendered by the page and streamed in later.
  tabs: React.ReactNode
}

export function ProjectDisplay(props: ProjectDisplayProps) {
  return (
    <CommentPromptProvider>
      <ProjectDisplayInner {...props} />
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
  const netVotes = countVotes(project) - savedMagnitude + myMagnitude
  const voteWeight =
    userProfile && userProfile.id !== project.creator ? karmaWeight(userProfile.karma) : 0
  const karmaDelta = (myMagnitude - savedMagnitude) * voteWeight
  return (
    <>
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
        pendingProjectTransfers.length === 0 && (
          <ProposalRequirements
            signedAgreement={project.signed_agreement}
            approved={project.approved === true}
            reachedMinFunding={amountRaised >= minIncludingAmm}
            projectSlug={project.slug}
          />
        )
      )}
      <Col className="gap-2">
        <ProjectScoreFlags aiFraction={project.ai_fraction} qualityScore={project.quality_score} />
        {/* above the title, the way feeds put "reposted by" above a post (F8) */}
        <NetworkLine items={props.network} size="sm" />
        <Col className="gap-1">
          <Row className="flex-2 items-center gap-3">
            <Karma
              value={project.karma + karmaDelta}
              breakdown={project.karma_breakdown}
              kind="project"
              size="md"
              placement="bottom-start"
            />
            <Col className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-tight text-gray-900 sm:text-2xl">
                {project.title}
                {isHighlyRatedByAi(project.project_ai_evals) && (
                  <AiTrophy href="?tab=ai-review" className="ml-2 inline-block align-middle" />
                )}
              </h2>
            </Col>
            <Vote
              projectId={project.id}
              userId={userProfile?.id}
              magnitude={myMagnitude}
              setMagnitude={setNewMagnitude}
              setCommentPrompt={setSpecialCommentPrompt}
            >
              <span className="text-sm text-gray-400">{netVotes}</span>
            </Vote>
          </Row>
          <Row className="mb-1 flex-wrap gap-1">
            {project.causes?.map((cause) => (
              <CauseTag key={cause.slug} causeTitle={cause.title} causeSlug={cause.slug} />
            ))}
          </Row>
        </Col>
        <div className="flex flex-col-reverse gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <Row className="flex-wrap items-center gap-1 text-sm text-gray-700">
            <UserAvatarAndBadge profile={project.profiles} />
            {creatorEmail && (
              <Tooltip text="Copy creator email">
                <EnvelopeIcon
                  className="h-4 w-4 cursor-pointer stroke-2 hover:text-gray-800"
                  onClick={async () => {
                    await navigator.clipboard.writeText(creatorEmail)
                  }}
                />
              </Tooltip>
            )}
            <span className="text-gray-400" aria-hidden="true">
              &middot;
            </span>
            <time dateTime={project.created_at} className="text-gray-500 font-light">
              created{' '}
              {formatDateUtc(project.created_at, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
            {pendingProjectTransfers.length > 0 && (
              <span className="text-gray-500">
                pending transfer to {pendingProjectTransfers[0].recipient_name}
              </span>
            )}
          </Row>
          <Row className="justify-between gap-2">
            {userProfile && !isOwnProject && (
              <ViewerActionPanel
                projectId={project.id}
                projectSlug={project.slug}
                currentlyFollowing={userIsFollower}
              />
            )}
            {(isOwnProject || userIsAdmin) && (
              <CreatorActionPanel
                project={project}
                causesList={causesList}
                prizeCause={prizeCause}
              />
            )}
            {userIsAdmin && (
              <AdminActionPanel
                project={project}
                projectBids={projectBids}
                projectTxns={projectTxns}
              />
            )}
          </Row>
        </div>
        <Col className="mb-4 gap-6 border-y border-gray-200 py-6">
          <ProjectTypeDisplay
            type={project.type}
            stage={project.stage}
            closeDate={project.auction_close ?? undefined}
          />
          <div>
            {(project.stage === 'proposal' ||
              (project.stage === 'active' && project.type === 'grant')) && (
              <ProgressBar
                amountRaised={amountRaised}
                minFunding={minIncludingAmm}
                fundingGoal={project.funding_goal}
              />
            )}
            <ProjectData
              minimum={minIncludingAmm}
              valuation={valuation}
              project={project}
              raised={amountRaised}
            />
          </div>
          {!['draft', 'proposal'].includes(project.stage) &&
            project.type === 'cert' &&
            !!project.amm_shares && (
              <CertValuationChart
                tradePoints={tradePoints}
                ammTxns={projectTxns.filter(
                  (txn) => txn.to_id === project.id || txn.from_id === project.id
                )}
                ammId={project.id}
                size="lg"
              />
            )}
          {project.type === 'cert' &&
            (project.stage === 'active' || project.stage === 'complete') && (
              <Trade
                ammTxns={
                  !!project.amm_shares
                    ? projectTxns.filter(
                        (txn) => txn.to_id === project.id || txn.from_id === project.id
                      )
                    : undefined
                }
                projectId={project.id}
                userSpendableFunds={userSpendableFunds}
                userSellableShares={userSellableShares}
                signedIn={!!userProfile}
              />
            )}
          {userProfile?.id !== project.creator &&
            project.type === 'cert' &&
            project.stage === 'proposal' && (
              <AssuranceBuyBox
                project={project}
                minValuation={valuation}
                offerSizePortion={
                  (activeAuction ? minIncludingAmm : minIncludingAmm - amountRaised) / valuation
                }
                maxBuy={userSpendableFunds}
                activeAuction={activeAuction}
                signedIn={!!userProfile}
              />
            )}
          {/* During EA Community Choice, permit donations to projects you own */}
          {/* {userProfile?.id !== project.creator && */}
          {project.type === 'grant' &&
            pendingProjectTransfers.length === 0 &&
            (project.stage === 'proposal' || project.stage === 'active') && (
              <>
                {amountRaised < project.funding_goal ? (
                  <DonateBox
                    project={project}
                    profile={userProfile}
                    maxDonation={userSpendableFunds}
                    fundingLeft={fundingLeft(project.funding_goal, amountRaised)}
                    setCommentPrompt={setSpecialCommentPrompt}
                  />
                ) : (
                  <span className="mx-auto mb-5 text-sm italic text-gray-500">
                    Fully funded and not currently accepting donations.
                  </span>
                )}
              </>
            )}
        </Col>
        {project.description && (
          <RichContent content={project.description} className="px-3 text-sm" />
        )}
        <div id="tabs">{tabs}</div>
      </Col>
    </>
  )
}

export function ProjectTypeDisplay(props: {
  type: Project['type']
  stage: Project['stage']
  closeDate?: string
}) {
  const { type, stage, closeDate } = props
  // Local noon (no Z) so every timezone renders the same calendar date
  const formattedCloseDate = closeDate
    ? format(new Date(`${closeDate}T12:00:00`), 'MMMM do, yyyy')
    : ''
  return (
    <Row className="justify-between">
      <Row className="gap-1">
        <span className="inline-flex items-center gap-x-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
          <StageIcon stage={stage} className="h-4 w-4" />
          {toSentenceCase(stage)}
        </span>
        <span className="inline-flex items-center gap-x-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
          {type === 'cert' ? (
            <Link
              href="/about/impact-certificates"
              className="inline-flex items-center gap-x-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600"
            >
              <ArrowTrendingUpIcon className="h-4 w-4" />
              Impact certificate
            </Link>
          ) : (
            <span className="inline-flex items-center gap-x-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
              <CircleStackIcon className="h-4 w-4" />
              Grant
            </span>
          )}
        </span>
      </Row>
      {closeDate && stage === 'proposal' && (
        <span className="text-xs text-gray-500">Closes {formattedCloseDate}</span>
      )}
    </Row>
  )
}

export function scrollToComments(router: any) {
  router.push('?tab=comments')
  const tabsElement = document.getElementById('tabs')
  tabsElement?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'start',
  })
}
