import { BidAndProfile, BidAndProject } from '@/db/bid'
import { Cause } from '@/db/cause'
import { getCommentsByProject } from '@/db/comment'
import { Profile } from '@/db/profile'
import { FullProject } from '@/db/project'
import { getFullSimilarProjectsCached } from '@/db/project-cached'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { TxnAndProfiles, TxnAndProject } from '@/db/txn'
import { ProjectTabs } from './project-tabs'
import { getViewerFunds } from './viewer-funds'
import { findFundComment } from '@/utils/fund-comments'
import { formatMoneyShort } from '@/utils/formatting'
import { fundPath } from '@/utils/funds'
import type { CommentTag } from '@/components/comments/comments-section'
import { SupabaseClient } from '@supabase/supabase-js'

// The tabs below the description (comments, offers, shareholders, similar projects). The page
// streams them in after the top: they need comments and similar projects, which the top doesn't.
export async function ProjectTabsSection(props: {
  project: FullProject
  userProfile?: Profile
  userTxns: TxnAndProject[]
  userBids: BidAndProject[]
  projectBids: BidAndProfile[]
  projectTxns: TxnAndProfiles[]
  prizeCause?: Cause
  // Funds the viewer runs: they can withdraw those funds' pending offers (F8)
  adminFundIds?: string[]
}) {
  const {
    project,
    userProfile,
    userTxns,
    userBids,
    projectBids,
    projectTxns,
    prizeCause,
    adminFundIds,
  } = props
  const supabase = await createServerSupabaseClient()
  const [comments, similarProjects, fundGifts] = await Promise.all([
    getCommentsByProject(supabase, project.id),
    getFullSimilarProjectsCached(project.id, 8),
    getFundGifts(supabase, project.id, projectTxns, projectBids),
  ])
  // F11: the fund's comment says what the fund gave, not what its admin gave personally
  const commentTags: Record<string, CommentTag> = {}
  for (const gift of fundGifts) {
    const comment = findFundComment(comments, gift.adminIds, gift.firstAt)
    if (!comment) continue
    commentTags[comment.id] = {
      text:
        gift.donated > 0
          ? `donated ${formatMoneyShort(gift.donated)} through ${gift.fundName}`
          : `offering ${formatMoneyShort(gift.offered)} through ${gift.fundName}`,
      href: fundPath(gift.fundUsername),
    }
  }
  const { userCharityBalance, userSpendableFunds, userSellableShares } = getViewerFunds(
    project,
    userProfile,
    userTxns,
    userBids
  )
  const activeAuction = !!prizeCause?.cert_params?.auction && project.stage === 'proposal'
  return (
    <ProjectTabs
      project={project}
      adminFundIds={adminFundIds}
      userProfile={userProfile}
      comments={comments}
      commentTags={commentTags}
      bids={projectBids}
      txns={projectTxns}
      userCharityBalance={userCharityBalance}
      userSpendableFunds={userSpendableFunds}
      userSellableShares={userSellableShares}
      activeAuction={activeAuction}
      similarProjects={similarProjects}
    />
  )
}

// What each fund gave or offered this project, and who runs it
async function getFundGifts(
  supabase: SupabaseClient,
  projectId: string,
  txns: TxnAndProfiles[],
  pendingBids: BidAndProfile[]
) {
  const funds = new Map<
    string,
    { fundName: string; fundUsername: string; donated: number; offered: number }
  >()
  const entry = (id: string, name: string, username: string) => {
    if (!funds.has(id))
      funds.set(id, { fundName: name, fundUsername: username, donated: 0, offered: 0 })
    return funds.get(id)!
  }
  for (const txn of txns) {
    if (txn.profiles?.type === 'fund' && txn.from_id && txn.token === 'USD' && !txn.bundle)
      entry(txn.from_id, txn.profiles.full_name, txn.profiles.username).donated += txn.amount
  }
  for (const bid of pendingBids) {
    if (bid.profiles?.type === 'fund' && bid.type === 'donate')
      entry(bid.bidder, bid.profiles.full_name, bid.profiles.username).offered += bid.amount
  }
  if (funds.size === 0) return []
  const fundIds = [...funds.keys()]
  // Accepted offers count too: they're often when the admin explained the grant
  const [{ data: admins }, { data: bids }] = await Promise.all([
    supabase
      .from('fund_admins')
      .select('fund_id, profile_id')
      .in('fund_id', fundIds)
      .throwOnError(),
    supabase
      .from('bids')
      .select('bidder, created_at')
      .eq('project', projectId)
      .in('bidder', fundIds)
      .throwOnError(),
  ])
  return fundIds.map((id) => {
    const times = [
      ...txns.filter((txn) => txn.from_id === id).map((txn) => txn.created_at),
      ...(bids ?? []).filter((bid) => bid.bidder === id).map((bid) => bid.created_at),
    ].sort()
    return {
      ...funds.get(id)!,
      adminIds: (admins ?? []).filter((a) => a.fund_id === id).map((a) => a.profile_id),
      firstAt: times[0],
    }
  })
}
