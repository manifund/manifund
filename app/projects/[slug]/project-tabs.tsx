'use client'
import { Comments } from './comments'
import { FullProject, FullProjectWithSimilarity, TOTAL_SHARES } from '@/db/project'
import { Profile } from '@/db/profile'
import { useSearchParams } from 'next/navigation'
import { Bids } from './bids'
import { BidAndProfile } from '@/db/bid'
import { TxnAndProfiles } from '@/db/txn'
import { Shareholders } from './shareholders'
import { bundleTxns } from '@/utils/math'
import { Tab, Tabs } from '@/components/tabs'
import { AI_HIGHLY_RATED_MIN_SCORE, latestAiEval } from '@/utils/karma'
import { AiReview } from './ai-review'
import { DonationsHistory } from '@/components/donations-history'
import { CommentAndProfileAndRxns, CommentAndProfile } from '@/db/comment'
import { uniq } from 'es-toolkit'
import { compareDesc } from 'date-fns'
import { formatMoneyPrecise, formatPercent } from '@/utils/formatting'
import { SimilarProjects } from './similar-projects'
import { useCommentPrompt } from './comment-prompt'

const SIMILARITY_THRESHOLD = 0.6

export function ProjectTabs(props: {
  project: FullProject
  comments: CommentAndProfileAndRxns[]
  bids: BidAndProfile[]
  txns: TxnAndProfiles[]
  userCharityBalance: number
  userSpendableFunds: number
  userSellableShares: number
  userProfile?: Profile
  activeAuction?: boolean
  similarProjects?: FullProjectWithSimilarity[]
}) {
  const {
    project,
    comments,
    bids,
    txns,
    userCharityBalance,
    userSpendableFunds,
    userSellableShares,
    userProfile,
    activeAuction,
    similarProjects,
  } = props
  const { prompt: specialCommentPrompt } = useCommentPrompt()
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const currentTabId = searchParams.get('tab')
  const creator = project.profiles
  const shareholders =
    (project.stage === 'active' || project.stage === 'complete') && project.type === 'cert'
      ? getShareholders(txns)
      : undefined
  const commenterContributions = getCommenterContributions(comments, bids, txns, shareholders)
  const tabs: Tab[] = [
    {
      name: 'Comments',
      id: 'comments',
      count: comments.length,
      display: (
        <Comments
          project={project}
          comments={comments}
          userProfile={userProfile}
          userCharityBalance={userCharityBalance}
          commenterContributions={commenterContributions}
          specialPrompt={specialCommentPrompt}
        />
      ),
    },
  ]

  if (
    ((project.stage === 'active' || project.stage === 'complete') && project.type === 'cert') ||
    project.stage === 'proposal'
  ) {
    const bidsToShow = bids.filter((bid) => bid.type !== 'assurance sell')
    tabs.push({
      name: 'Offers',
      id: 'bids',
      count: bidsToShow.length,
      display: (
        <Bids
          bids={bidsToShow}
          project={project}
          userProfile={userProfile}
          userSpendableFunds={userSpendableFunds}
          userSellableShares={userSellableShares}
          activeAuction={activeAuction}
        />
      ),
    })
  }
  if (shareholders) {
    tabs.push({
      name: 'Shareholders',
      id: 'shareholders',
      count: shareholders.length,
      display: (
        <Shareholders
          shareholders={shareholders}
          creator={creator}
          txns={txns}
          projectId={project.id}
          usingAmm={!!project.amm_shares && project.amm_shares > 0}
        />
      ),
    })
  }

  if ((project.stage === 'active' || project.stage === 'complete') && project.type === 'grant') {
    const donations = txns.filter((txn) => txn.type === 'project donation')
    tabs.push({
      name: 'Donations',
      id: 'donations',
      count: donations.length,
      display: (
        <DonationsHistory
          donations={donations}
          replyContext={{
            projectId: project.id,
            projectSlug: project.slug,
            userProfile,
          }}
        />
      ),
    })
  }

  const aiEval = latestAiEval(project.project_ai_evals)
  if (aiEval && (aiEval.score ?? 0) >= AI_HIGHLY_RATED_MIN_SCORE && aiEval.opinion) {
    tabs.push({ name: 'AI review', id: 'ai-review', display: <AiReview evaluation={aiEval} /> })
  }

  // Disable predictions tab for now, as it's not getting any usage
  // const markets = project.markets as string[]
  // tabs.push({
  //   name: 'Predictions',
  //   id: 'predictions',
  //   display: <MarketTab project={project} userProfile={userProfile} />,
  //   count: markets?.length ?? 0,
  // })

  const similarEnoughSimilarProjects = similarProjects?.filter(
    (project) => project.similarity > SIMILARITY_THRESHOLD
  )

  if (similarEnoughSimilarProjects?.length) {
    tabs.push({
      name: 'Similar',
      id: 'similar',
      count: similarEnoughSimilarProjects.length,
      display: <SimilarProjects similarProjects={similarEnoughSimilarProjects} />,
    })
  }

  return <Tabs tabs={tabs} currentTabId={currentTabId} />
}

export type Shareholder = {
  profile: Profile
  numShares: number
}
export function getShareholders(txns: TxnAndProfiles[]) {
  const bundledTxns = bundleTxns(txns)
  const shareholders = Object.fromEntries(
    txns.flatMap((txn) => [
      [txn.from_id, { numShares: 0 } as Shareholder],
      [txn.to_id, { numShares: 0 } as Shareholder],
    ])
  )
  for (const bundle of bundledTxns) {
    for (const txn of bundle) {
      if (txn.token === 'USD' && txn.from_id) {
        shareholders[txn.from_id].profile = txn.profiles as Profile
      } else {
        shareholders[txn.to_id].numShares += txn.amount
        if (txn.from_id) {
          shareholders[txn.from_id].numShares -= txn.amount
          shareholders[txn.from_id].profile = txn.profiles as Profile
        }
      }
    }
  }
  const shareholdersArray = Object.values(shareholders) as Shareholder[]
  // Round for small arithmetic errors
  shareholdersArray.forEach((shareholder) => {
    shareholder.numShares = Math.round(shareholder.numShares)
  })
  return shareholdersArray.filter((shareholder) => !!shareholder.profile)
}

export function getCommenterContributions(
  comments: CommentAndProfile[],
  bids: BidAndProfile[],
  txns: TxnAndProfiles[],
  shareholders?: Shareholder[]
) {
  const commenterIds = uniq(comments.map((comment) => comment.commenter))
  const contributions = Object.fromEntries(commenterIds.map((commenterId) => [commenterId, '']))
  commenterIds.forEach((commenterId) => {
    if (shareholders) {
      const holding = shareholders.find((shareholder) => shareholder.profile.id === commenterId)
      if (holding) {
        contributions[commenterId] = `holds ${formatPercent(holding.numShares / TOTAL_SHARES)}`
      }
    }
    if (!contributions[commenterId] && txns) {
      const donations = txns.filter(
        (txn) => txn.from_id === commenterId && txn.token === 'USD' && !txn.bundle
      )
      const totalDonated = donations.reduce((total, txn) => total + txn.amount, 0)
      if (totalDonated > 0) {
        contributions[commenterId] = `donated ${formatMoneyPrecise(totalDonated)}`
      }
    }
    if (!contributions[commenterId]) {
      const relevantBids = bids.filter(
        (bid) => bid.status === 'pending' && bid.bidder === commenterId
      )
      const sortedBids = relevantBids.sort((a, b) =>
        compareDesc(new Date(a.created_at), new Date(b.created_at))
      )
      const latestBid = sortedBids[0]
      if (latestBid) {
        const offered = formatMoneyPrecise(relevantBids.reduce((acc, bid) => acc + bid.amount, 0))
        contributions[commenterId] =
          latestBid.type === 'donate' ||
          latestBid.type === 'buy' ||
          latestBid.type === 'assurance buy'
            ? `offering ${offered}`
            : `selling at ${formatMoneyPrecise(latestBid.valuation)}`
      }
    }
  })
  return contributions
}
