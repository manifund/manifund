// All tunable constants for karma. Change these (or pass an override to
// computeKarma) and re-run the recompute; nothing in the DB encodes the formula.
export const KARMA_CONFIG = {
  // Multiplier on the portion of a donation committed before the project hit min funding
  earlyDonationMultiplier: 1.5,
  // [karma threshold, weight], ascending. Below the first threshold the weight is 0.
  weightTiers: [
    [10, 1],
    [100, 2],
    [1000, 3],
  ] as [number, number][],
  positiveReacts: ['➕', '🥳', '💡', '🔥', '👏', '🌈'],
  // Applied to every react on top of the reactor's weight (and tip multiplier)
  reactMultiplier: 2,
  tippedReactMultipliers: { '🧡': 2, '🏅': 3, '🏆': 5 } as Record<string, number>,
  // project karma += creatorKarmaCoefficient * log10(1 + creator karma)
  creatorKarmaCoefficient: 5,
  // homepage: project karma / (age in days + 1) ^ hotAgeExponent
  hotAgeExponent: 1.5,
  maxIterations: 10,
  convergenceEpsilon: 0.01,
  excludedProjectStages: ['hidden', 'draft'],
}
export type KarmaConfig = typeof KARMA_CONFIG

// Minimal row shapes; db/karma.ts selects exactly these columns.
export type KarmaProfileRow = {
  id: string
  username: string
  full_name: string
}
export type KarmaProjectRow = {
  id: string
  creator: string
  created_at: string
  stage: string
  type: string
  title: string
  slug: string
}
export type KarmaVoteRow = { voter_id: string; project_id: string; magnitude: number }
export type KarmaCommentRow = { id: string; commenter: string; project: string | null }
export type KarmaRxnRow = {
  comment_id: string
  reactor_id: string
  reaction: string
  txn_id: string | null
}
export type KarmaBidRow = {
  bidder: string
  project: string
  amount: number
  type: string
  status: string
}
export type KarmaTxnRow = {
  from_id: string | null
  to_id: string
  amount: number
  type: string | null
  token: string
  project: string | null
}

export type KarmaInputs = {
  profiles: KarmaProfileRow[]
  projects: KarmaProjectRow[]
  votes: KarmaVoteRow[]
  comments: KarmaCommentRow[]
  commentRxns: KarmaRxnRow[]
  bids: KarmaBidRow[]
  txns: KarmaTxnRow[]
  // Txns from the bank account seed cert AMMs and are not real donations.
  bankId: string | undefined
}

export type ProfileKarmaBreakdown = {
  donationsGiven: number
  donationsReceived: number
  votes: number
  reacts: number
  projectsDonatedTo: number
  voteCount: number
  reactCount: number
}
export type ProjectKarmaBreakdown = {
  votes: number
  comments: number
  donations: number
  creator: number
  voteCount: number
  commentCount: number
  donorCount: number
  creatorKarma: number
}
export type KarmaResult = {
  profiles: Map<string, { karma: number; breakdown: ProfileKarmaBreakdown }>
  projects: Map<string, { karma: number; breakdown: ProjectKarmaBreakdown }>
  iterations: number
  converged: boolean
}

export function karmaWeight(karma: number, config: KarmaConfig = KARMA_CONFIG) {
  let weight = 0
  for (const [threshold, w] of config.weightTiers) {
    if (karma >= threshold) weight = w
  }
  return weight
}

// Project donation term. Swappable; currently sum over donors of sqrt(amount).
export function quadraticDonationScore(
  amountByDonor: Map<string, number>,
  _config: KarmaConfig = KARMA_CONFIG
) {
  let score = 0
  for (const amount of amountByDonor.values()) score += Math.sqrt(Math.max(amount, 0))
  return score
}

export function projectHotScore(
  karma: number | null | undefined,
  createdAt: string,
  now: number = Date.now(),
  config: KarmaConfig = KARMA_CONFIG
) {
  const ageDays = Math.max(0, now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  return (karma ?? 0) / (ageDays + 1) ** config.hotAgeExponent
}

type Donation = { total: number; early: number }

export function computeKarma(inputs: KarmaInputs, config: KarmaConfig = KARMA_CONFIG): KarmaResult {
  const excludedStages = new Set(config.excludedProjectStages)
  const projects = inputs.projects.filter((p) => !excludedStages.has(p.stage))
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const profileById = new Map(inputs.profiles.map((p) => [p.id, p]))

  const votes = inputs.votes.filter((v) => {
    const project = projectById.get(v.project_id)
    return project && v.magnitude !== 0 && v.voter_id !== project.creator
  })

  const commentById = new Map(inputs.comments.map((c) => [c.id, c]))
  // Comments on live projects by someone other than the creator
  const projectComments = inputs.comments.filter((c) => {
    const project = c.project ? projectById.get(c.project) : undefined
    return project && c.commenter !== project.creator
  })

  const positiveReacts = new Set(config.positiveReacts)
  const rxns = inputs.commentRxns
    .map((r) => ({ rxn: r, comment: commentById.get(r.comment_id) }))
    .filter(({ rxn, comment }) => {
      if (!comment || rxn.reactor_id === comment.commenter) return false
      return positiveReacts.has(rxn.reaction) || rxn.reaction in config.tippedReactMultipliers
    })

  // donations: donor -> project -> {total, early}
  const donations = new Map<string, Map<string, Donation>>()
  const addDonation = (donor: string, projectId: string, amount: number, early: number) => {
    if (amount <= 0) return
    let byProject = donations.get(donor)
    if (!byProject) donations.set(donor, (byProject = new Map()))
    const d = byProject.get(projectId) ?? { total: 0, early: 0 }
    d.total += amount
    d.early += early
    byProject.set(projectId, d)
  }

  const acceptedBidTotal = new Map<string, number>()
  for (const bid of inputs.bids) {
    if (bid.type !== 'donate') continue
    const project = projectById.get(bid.project)
    if (!project || bid.bidder === project.creator) continue
    if (bid.status === 'pending' && project.stage === 'proposal') {
      // Money committed to a live proposal counts right away, and is early by definition
      addDonation(bid.bidder, bid.project, bid.amount, bid.amount)
    } else if (bid.status === 'accepted') {
      const key = `${bid.bidder}|${bid.project}`
      acceptedBidTotal.set(key, (acceptedBidTotal.get(key) ?? 0) + bid.amount)
    }
  }

  const txnTotal = new Map<string, number>()
  for (const txn of inputs.txns) {
    if (txn.type !== 'project donation' || txn.token !== 'USD' || !txn.project) continue
    if (!txn.from_id || txn.from_id === inputs.bankId || txn.from_id === txn.to_id) continue
    const project = projectById.get(txn.project)
    if (!project || project.stage === 'proposal' || txn.from_id === project.creator) continue
    const key = `${txn.from_id}|${txn.project}`
    txnTotal.set(key, (txnTotal.get(key) ?? 0) + txn.amount)
  }
  for (const [key, total] of txnTotal) {
    const [donor, projectId] = key.split('|')
    // No txn->bid link exists; accepted donate bids became txns on activation,
    // so the accepted-bid total (capped by what was actually sent) is the early portion.
    const early = Math.min(total, acceptedBidTotal.get(key) ?? 0)
    addDonation(donor, projectId, total, early)
  }

  // Base (non-recursive) components
  const breakdowns = new Map<string, ProfileKarmaBreakdown>()
  const ensure = (id: string) => {
    let b = breakdowns.get(id)
    if (!b) {
      b = {
        donationsGiven: 0,
        donationsReceived: 0,
        votes: 0,
        reacts: 0,
        projectsDonatedTo: 0,
        voteCount: 0,
        reactCount: 0,
      }
      breakdowns.set(id, b)
    }
    return b
  }
  for (const profile of inputs.profiles) ensure(profile.id)
  const projectDonors = new Map<string, Map<string, number>>()
  for (const [donor, byProject] of donations) {
    const b = ensure(donor)
    for (const [projectId, d] of byProject) {
      const earlyFraction = d.early / d.total
      b.donationsGiven +=
        Math.sqrt(d.total) * (1 + (config.earlyDonationMultiplier - 1) * earlyFraction)
      b.projectsDonatedTo += 1
      const creator = projectById.get(projectId)!.creator
      ensure(creator).donationsReceived += Math.sqrt(d.total)
      let donors = projectDonors.get(projectId)
      if (!donors) projectDonors.set(projectId, (donors = new Map()))
      donors.set(donor, (donors.get(donor) ?? 0) + d.total)
    }
  }
  const base = new Map<string, number>()
  for (const [id, b] of breakdowns) {
    base.set(id, b.donationsGiven + b.donationsReceived)
  }

  // Iterate to a fixed point: vote/react weights depend on the voter's karma.
  let karma = new Map(base)
  const k = (id: string) => karma.get(id) ?? 0
  let iterations = 0
  let converged = false
  for (; iterations < config.maxIterations; ) {
    iterations++
    const voteTerm = new Map<string, number>()
    const reactTerm = new Map<string, number>()
    for (const v of votes) {
      const creator = projectById.get(v.project_id)!.creator
      voteTerm.set(
        creator,
        (voteTerm.get(creator) ?? 0) + v.magnitude * karmaWeight(k(v.voter_id), config)
      )
    }
    for (const { rxn, comment } of rxns) {
      const mult =
        config.reactMultiplier *
        (rxn.txn_id ? (config.tippedReactMultipliers[rxn.reaction] ?? 1) : 1)
      const c = comment!.commenter
      reactTerm.set(c, (reactTerm.get(c) ?? 0) + karmaWeight(k(rxn.reactor_id), config) * mult)
    }
    const next = new Map<string, number>()
    const ids = new Set([...base.keys(), ...voteTerm.keys(), ...reactTerm.keys()])
    let maxDelta = 0
    for (const id of ids) {
      const value = (base.get(id) ?? 0) + (voteTerm.get(id) ?? 0) + (reactTerm.get(id) ?? 0)
      next.set(id, value)
      maxDelta = Math.max(maxDelta, Math.abs(value - k(id)))
      const b = ensure(id)
      b.votes = voteTerm.get(id) ?? 0
      b.reacts = reactTerm.get(id) ?? 0
    }
    karma = next
    if (maxDelta < config.convergenceEpsilon) {
      converged = true
      break
    }
  }
  for (const v of votes) ensure(projectById.get(v.project_id)!.creator).voteCount += 1
  for (const { comment } of rxns) ensure(comment!.commenter).reactCount += 1

  const profiles: KarmaResult['profiles'] = new Map()
  for (const [id, breakdown] of breakdowns) {
    if (!profileById.has(id)) continue
    profiles.set(id, { karma: k(id), breakdown })
  }

  const projectResults: KarmaResult['projects'] = new Map()
  const projectBreakdown = new Map<string, ProjectKarmaBreakdown>()
  for (const p of projects) {
    const creatorKarma = k(p.creator)
    projectBreakdown.set(p.id, {
      votes: 0,
      comments: 0,
      donations: quadraticDonationScore(projectDonors.get(p.id) ?? new Map(), config),
      creator: config.creatorKarmaCoefficient * Math.log10(1 + Math.max(creatorKarma, 0)),
      voteCount: 0,
      commentCount: 0,
      donorCount: projectDonors.get(p.id)?.size ?? 0,
      creatorKarma,
    })
  }
  for (const v of votes) {
    const b = projectBreakdown.get(v.project_id)!
    b.votes += v.magnitude * karmaWeight(k(v.voter_id), config)
    b.voteCount += 1
  }
  for (const c of projectComments) {
    const b = projectBreakdown.get(c.project!)!
    b.comments += karmaWeight(k(c.commenter), config)
    b.commentCount += 1
  }
  for (const [id, b] of projectBreakdown) {
    projectResults.set(id, { karma: b.votes + b.comments + b.donations + b.creator, breakdown: b })
  }

  return { profiles, projects: projectResults, iterations, converged }
}
