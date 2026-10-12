import { BidAndProject } from '@/db/bid'
import { Profile } from '@/db/profile'
import { FullProject } from '@/db/project'
import { TxnAndProject } from '@/db/txn'
import {
  calculateCashBalance,
  calculateCharityBalance,
  calculateSellableShares,
} from '@/utils/math'

// What the viewer can spend on this project. Shared by the top of the page and the tabs,
// which render separately since the tabs stream in after the top.
export function getViewerFunds(
  project: FullProject,
  userProfile: Profile | undefined,
  userTxns: TxnAndProject[],
  userBids: BidAndProject[]
) {
  const userCharityBalance = userProfile
    ? calculateCharityBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
    : 0
  const userSpendableFunds = Math.max(
    userProfile
      ? project.type === 'cert' && userProfile.id === project.creator
        ? calculateCashBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
        : userCharityBalance
      : 0,
    0
  )
  const userSellableShares = userProfile
    ? calculateSellableShares(userTxns, userBids, project.id, userProfile.id)
    : 0
  return { userCharityBalance, userSpendableFunds, userSellableShares }
}
