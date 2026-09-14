import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/table-catalyst'
import { BidAndProfile } from '@/db/bid'
import { Project } from '@/db/project'
import { TxnAndProfiles } from '@/db/txn'
import { keyBy, sum } from 'es-toolkit'
import Link from 'next/link'

// A single donation or offer, used for calculating quadratic funding match
type Vote = {
  projectId: string
  donorId: string
  amount: number
}

type VoteMap = {
  [projectId: string]: {
    [donorId: string]: number
  }
}

// Txns & offers in 08-12 to 09-05 are eligible for EA Community Choice
export const MATCH_START = '2024-08-12T00:00:00.000Z'
export const MATCH_END = '2024-09-05T11:59:59.999Z'
function eligibleTime(createdAt: string) {
  const date = new Date(createdAt)
  return new Date(MATCH_START) <= date && date < new Date(MATCH_END)
}

export default function QuadraticMatch(props: {
  projects?: Project[]
  matchTxns?: TxnAndProfiles[]
  matchBids?: BidAndProfile[]
}) {
  const { projects = [], matchTxns = [], matchBids = [] } = props

  const projectMap = keyBy(projects, (p) => p.id)
  // const profiles = [
  //   ...matchTxns.map((txn) => txn.profiles),
  //   ...matchBids.map((bid) => bid.profiles),
  // ]
  // const profileMap = keyBy(profiles, 'id')
  const votes: Vote[] = []
  const voteMap: VoteMap = {}

  // Consolidate txns and bids into a single list of votes
  matchTxns.forEach((txn) => {
    if (!txn.project || !txn.profiles) return
    if (!eligibleTime(txn.created_at)) return
    votes.push({
      projectId: txn.project,
      donorId: txn.profiles.id,
      amount: txn.amount,
    })
  })
  matchBids.forEach((bid) => {
    if (!bid.profiles) return
    if (!eligibleTime(bid.created_at)) return
    votes.push({
      projectId: bid.project,
      donorId: bid.profiles.id,
      amount: bid.amount,
    })
  })

  // Build up the vote map
  votes.forEach((vote) => {
    const { projectId, donorId, amount } = vote
    if (!voteMap[projectId]) voteMap[projectId] = {}
    // Merge "votes" from the same donor
    voteMap[projectId][donorId] = (voteMap[projectId][donorId] || 0) + amount
  })

  // Calculate quadratic match: square of sum of square roots of vote amounts
  function rawMatch(votes: Record<string, number>) {
    const sqrtVotes = sum(Object.values(votes).map((v) => Math.sqrt(v)))
    return Math.round(sqrtVotes * sqrtVotes)
  }
  function total(votes: Record<string, number>) {
    return sum(Object.values(votes))
  }
  const totalRawMatch = sum(Object.values(voteMap).map(rawMatch))
  const POOL_SIZE = 100_000
  function match(votes: Record<string, number>) {
    return (rawMatch(votes) / totalRawMatch) * POOL_SIZE
  }

  return (
    <div>
      <p>Donations made during EA Community Choice qualify for the $100k matching pool!</p>
      <p className="mb-4 text-sm font-extralight italic text-gray-500">
        All amounts are projections; they may change based on further donations or at
        Manifund&apos;s discretion.
      </p>
      <Table dense>
        <TableRow>
          <TableHeader>Project</TableHeader>
          <TableHeader># Donors</TableHeader>
          <TableHeader>Donated</TableHeader>
          <TableHeader>Matched</TableHeader>
          <TableHeader>Total</TableHeader>
        </TableRow>
        <TableBody>
          {/* First row is total across projects */}
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>{new Set(votes.map((vote) => vote.donorId)).size}</TableCell>
            <TableCell>{sum(votes.map((vote) => vote.amount)).toFixed(0)}</TableCell>
            <TableCell>{POOL_SIZE}</TableCell>
            <TableCell>{(POOL_SIZE + sum(votes.map((vote) => vote.amount))).toFixed(0)}</TableCell>
          </TableRow>

          {/* Sort table by total donated, thencreate one row per project */}
          {Object.entries(voteMap)
            .sort(
              ([idA, votesA], [idB, votesB]) =>
                total(votesB) + match(votesB) - (total(votesA) + match(votesA))
            )
            .map(([projectId, votes]) => {
              // Projects hidden since the round still received votes but
              // aren't in the cause's visible project list
              const project = projectMap[projectId]
              return (
                <TableRow key={projectId}>
                  <TableCell>
                    {project ? (
                      <Link href={`/projects/${project.slug}`} className="hover:underline">
                        {project.title.slice(0, 60)}
                      </Link>
                    ) : (
                      <span className="text-gray-500">Hidden project</span>
                    )}
                  </TableCell>
                  <TableCell>{Object.keys(votes).length}</TableCell>
                  <TableCell>{total(votes).toFixed(0)}</TableCell>
                  <TableCell>{match(votes).toFixed(0)}</TableCell>
                  <TableCell>{(total(votes) + match(votes)).toFixed(0)}</TableCell>
                </TableRow>
              )
            })}
        </TableBody>
      </Table>
    </div>
  )
}
