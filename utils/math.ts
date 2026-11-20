import { Bid, BidAndProject } from '@/db/bid'
import { FullProject, Project } from '@/db/project'
import { TOTAL_SHARES } from '@/db/project'
import { FullTxn, Txn, TxnAndProject } from '@/db/txn'
import { isBefore } from 'date-fns'
import { sortBy } from 'es-toolkit'
import { DONOR_FEE_RATE, DONOR_FEE_THRESHOLD, isCharitableDeposit } from './constants'
import { calculateAMMPorfolio, calculateValuation } from './amm'

const IGNORE_ACCREDITATION_DATE = new Date('2023-11-02')

export function getProjectValuation(project: FullProject) {
  return project.type === 'grant'
    ? project.funding_goal
    : project.stage === 'proposal'
      ? getProposalValuation(project)
      : getActiveValuation(
          project.txns,
          project.bids,
          project.id,
          !!project.amm_shares,
          getProposalValuation(project)
        )
}

export function getProposalValuation(project: Project) {
  const { min_funding, amm_shares, founder_shares } = project
  const investorPercent = (TOTAL_SHARES - founder_shares - (amm_shares ?? 0)) / TOTAL_SHARES
  return min_funding / investorPercent
}

export function getMinIncludingAmm(project: Project) {
  const { min_funding, amm_shares, type } = project
  return (
    min_funding +
    ((amm_shares ?? 0) / TOTAL_SHARES) * (type === 'cert' ? getProposalValuation(project) : 1)
  )
}

function getActiveValuation(
  txns: Txn[],
  bids: Bid[],
  projectId: string,
  activeAmm: boolean,
  minValuation: number
) {
  const ammTxns = txns.filter(
    (txn) => txn.type === 'user to amm trade' || txn.type === 'inject amm liquidity'
  )
  if (ammTxns.length === 0 || !activeAmm) {
    const userTradeTxns = txns.filter((txn) => txn.type === 'user to user trade')
    if (userTradeTxns.length === 0) {
      const pendingBids = bids.filter((bid) => bid.status === 'pending')
      if (pendingBids.length > 0) {
        const sortedBids = sortBy(pendingBids, [(bid) => bid.created_at])
        const latestBid = sortedBids[sortedBids.length - 1]
        return latestBid.valuation
      } else {
        return minValuation
      }
    } else {
      const bundles = bundleTxns(userTradeTxns)
      const sortedBundles = sortBy(bundles, [(bundle) => bundle[0].created_at])
      const latestBundle = sortedBundles[sortedBundles.length - 1]
      const amountUSD = latestBundle.find((txn) => txn.token === 'USD')?.amount ?? 0
      const numShares = latestBundle.find((txn) => txn.token !== 'USD')?.amount ?? 1
      return (amountUSD / numShares) * TOTAL_SHARES
    }
  } else {
    const [ammShares, ammUSD] = calculateAMMPorfolio(ammTxns, projectId)
    return calculateValuation(ammShares, ammUSD)
  }
}

// Cliff: once lifetime deposits (including this one) pass the threshold, the whole deposit is charged, in whole dollars
export function calculateDonorFee(priorDeposits: number, amount: number) {
  if (amount <= 0 || priorDeposits + amount <= DONOR_FEE_THRESHOLD) return 0
  return Math.floor(amount * DONOR_FEE_RATE)
}

export function calculateUserBalance(txns: Txn[], userId: string) {
  let balance = 0
  txns.forEach((txn) => {
    balance += txn.amount * getBalanceMultiplier(txn, userId)
  })
  return balance
}

export function getAmountRaised(project: Project, bids?: Bid[], txns?: Txn[]) {
  if (project.type === 'dummy') {
    return project.funding_goal
  }
  return (
    (project.stage === 'proposal'
      ? bids
          ?.filter(
            (bid) =>
              (bid.type === 'buy' || bid.type === 'assurance buy' || bid.type === 'donate') &&
              bid.status === 'pending'
          )
          .reduce((acc, bid) => acc + bid.amount, 0)
      : txns
          ?.filter((txn) => txn.to_id === project.creator && txn.token === 'USD')
          .reduce((acc, txn) => acc + txn.amount, 0)) ?? 0
  )
}

export function calculateUserLockedFunds(bids: Bid[]) {
  const lockedFunds = bids
    .filter((bid) => bid.status === 'pending' && (bid.type === 'buy' || bid.type === 'donate'))
    .reduce((acc, bid) => acc + bid.amount, 0)
  return lockedFunds
}

export function calculateShares(txns: Txn[], userId: string, projectId: string) {
  let shares = 0
  txns.forEach((txn) => {
    const incoming = txn.to_id === userId
    if (txn.token === projectId) {
      shares += incoming ? txn.amount : -txn.amount
    }
  })
  return shares
}

export function calculateOfferedShares(bids: Bid[], projectId: string) {
  const offeredShares = bids
    .filter((bid) => bid.type === 'sell' && bid.status === 'pending' && bid.project === projectId)
    ?.reduce((acc, bid) => acc + bid.amount, 0)
  return offeredShares
}

export function calculateSellableShares(
  txns: Txn[],
  bids: Bid[],
  projectId: string,
  userId: string
) {
  const shares = calculateShares(txns, userId, projectId)
  const offeredShares = calculateOfferedShares(bids, projectId)
  return shares - offeredShares
}

export function bundleTxns(txns: FullTxn[]) {
  const bundledTxns = txns
    .map((txn) => {
      if (txn.bundle && txn.token === 'USD') {
        return [txn, txns.find((t) => t.bundle === txn.bundle && t.token !== 'USD')]
      } else if (!txn.bundle) {
        return [txn]
      } else {
        return null
      }
    })
    .filter((txn) => txn !== null) as FullTxn[][]
  return bundledTxns
}

export function calculateCashBalance(
  txns: TxnAndProject[],
  bids: BidAndProject[],
  userId: string,
  accreditationStatus: boolean
) {
  let cashBalance = 0
  const sortedTxns = sortBy(txns, ['created_at'])
  sortedTxns.forEach((txn) => {
    cashBalance += txn.amount * getTxnCashMultiplier(txn, userId, accreditationStatus)
  })
  bids.forEach((bid) => {
    cashBalance += bid.amount * getBidCashMultiplier(bid)
  })
  return cashBalance
}

export function calculateCharityBalance(
  txns: TxnAndProject[],
  bids: BidAndProject[],
  userId: string,
  accreditationStatus: boolean
) {
  let charityBalance = 0
  const sortedTxns = sortBy(txns, ['created_at'])

  sortedTxns.forEach((txn) => {
    charityBalance += txn.amount * getTxnCharityMultiplier(txn, userId, accreditationStatus)
  })
  bids.forEach((bid) => {
    charityBalance += bid.amount * getBidCharityMultiplier(bid)
  })
  return charityBalance
}

// These functions return -1, 0, or 1, depending on the effect that the transaction or bid has on the user's balance types.
// E.g. an outgoing donation gets a -1 multiplier for charity, and 0 for withdrawable.
// A deposit gets 1 for charity and 0 for withdrawable for an unaccredited user, and vice versa for accredited users.
// Withdrawable = investable for accredited investors
export function getBalanceMultiplier(txn: Txn, userId: string) {
  if (txn.token !== 'USD') {
    return 0
  } else {
    return txn.to_id === userId ? (txn.from_id === userId ? 0 : 1) : -1
  }
}

function getBidCharityMultiplier(bid: BidAndProject) {
  const projectIsBidders = bid.projects.creator === bid.bidder
  if (
    bid.status !== 'pending' ||
    bid.type === 'sell' ||
    bid.type === 'assurance sell' ||
    bid.projects.stage === 'hidden' ||
    projectIsBidders
  ) {
    return 0
  } else {
    return -1
  }
}

export function getBidCashMultiplier(bid: {
  status: string
  type: string
  bidder: string
  projects: { creator: string; stage: string }
}) {
  const projectIsBidders = bid.projects.creator === bid.bidder
  if (
    bid.status !== 'pending' ||
    bid.type === 'sell' ||
    bid.type === 'assurance sell' ||
    bid.projects.stage === 'hidden' ||
    !projectIsBidders
  ) {
    return 0
  } else {
    return -1
  }
}

export function getTxnCharityMultiplier(txn: TxnAndProject, userId: string, accredited: boolean) {
  if (
    txn.token !== 'USD' ||
    (txn.from_id !== userId && txn.to_id !== userId) ||
    txn.type === 'withdraw'
  ) {
    return 0
  }
  const isIncoming = txn.to_id === userId
  const isOwnProject = txn.projects?.creator === userId
  const actuallyAccredited =
    isBefore(new Date(txn.created_at), IGNORE_ACCREDITATION_DATE) && accredited
  if (txn.type === 'cash to charity transfer' || txn.type === 'mana deposit') {
    return 1
  }
  if (txn.type === 'fee') {
    return isIncoming ? 0 : -1
  }
  if (isIncoming && txn.from_id === userId) {
    // Donations to own project should decrement charity balance
    return isOwnProject ? -1 : 0
  }
  if (txn.type === 'project donation') {
    return isIncoming ? 0 : -1
  }
  if (txn.type === 'profile donation' || txn.type === 'tip' || txn.type === 'return bank funds') {
    return isIncoming ? 1 : -1
  }
  if (txn.type === 'user to amm trade' || txn.type === 'user to user trade') {
    if (isOwnProject || actuallyAccredited) {
      return 0
    } else {
      return isIncoming ? 1 : -1
    }
  }
  if (txn.type === 'inject amm liquidity') {
    return isOwnProject ? 0 : isIncoming ? 1 : -1
  }
  if (txn.type === 'deposit') {
    return actuallyAccredited && !isCharitableDeposit(txn.id) ? 0 : 1
  }
  return 0
}

export function getTxnCashMultiplier(txn: FullTxn, userId: string, accredited: boolean) {
  return getTxnCashMultiplierRaw(txn, userId, txn.projects?.creator ?? null, accredited)
}

// Same rules as getTxnCashMultiplier, for callers without a joined projects row
// (e.g. utils/idle-balances.ts, which pages over every USD txn).
export function getTxnCashMultiplierRaw(
  txn: {
    id: string
    token: string
    type: string | null
    created_at: string
    from_id: string | null
    to_id: string
  },
  userId: string,
  projectCreator: string | null,
  accredited: boolean
) {
  if (
    txn.token !== 'USD' ||
    (txn.from_id !== userId && txn.to_id !== userId) ||
    txn.type === 'profile donation' ||
    txn.type === 'tip' ||
    txn.type === 'return bank funds' ||
    txn.type === 'fee'
  ) {
    return 0
  }
  const isIncoming = txn.to_id === userId
  const isOwnProject = projectCreator === userId
  const actuallyAccredited =
    isBefore(new Date(txn.created_at), IGNORE_ACCREDITATION_DATE) && accredited
  if (txn.type === 'cash to charity transfer') {
    return -1
  }
  if (isIncoming && txn.from_id === userId) {
    // Donations to own project should increment cash balance
    return isOwnProject ? 1 : 0
  }
  if (txn.type === 'project donation') {
    return isIncoming ? 1 : 0
  }
  if (txn.type === 'user to amm trade' || txn.type === 'user to user trade') {
    if (isOwnProject || actuallyAccredited) {
      return isIncoming ? 1 : -1
    } else {
      return 0
    }
  }
  if (txn.type === 'inject amm liquidity') {
    return isOwnProject ? (isIncoming ? 1 : -1) : 0
  }
  if (txn.type === 'deposit') {
    return actuallyAccredited && !isCharitableDeposit(txn.id) ? 1 : 0
  }
  if (txn.type === 'withdraw') {
    return -1
  }
  return 0
}
