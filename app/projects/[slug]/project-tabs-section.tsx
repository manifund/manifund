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
}) {
  const { project, userProfile, userTxns, userBids, projectBids, projectTxns, prizeCause } = props
  const supabase = await createServerSupabaseClient()
  const [comments, similarProjects] = await Promise.all([
    getCommentsByProject(supabase, project.id),
    getFullSimilarProjectsCached(project.id, 8),
  ])
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
      userProfile={userProfile}
      comments={comments}
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
