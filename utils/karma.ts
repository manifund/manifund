// All tunable constants for karma. Change these (or pass an override to
// computeKarma) and re-run the recompute; nothing in the DB encodes the formula.
export const KARMA_CONFIG = {
  // Multiplier on the portion of a donation committed before the project hit min funding
  earlyDonationMultiplier: 1.5,
  // Dollars -> karma: amount ^ donationExponent (0.5 = square root). Lower = big gifts count less.
  donationExponent: 0.3,
  // Multiplier on the above; 1 for plain square root. 2.5 keeps $100 ≈ 10 karma at exponent 0.3.
  donationScale: 2.5,
  // [karma threshold, weight], ascending. Below the first threshold the weight is 0.
  // Granted once someone has put money in (a txn of one of these types to them), so a
  // depositor's first upvote carries weight log10(10) = 1 while throwaway accounts stay at 0
  startingKarma: 10,
  startingKarmaTxnTypes: ['deposit', 'mana deposit'],
  // Vote/react weight = log10(voter karma) - weightOffset, floored at 0.
  // With offset 0: 10 -> 1, 100 -> 2, 1000 -> 3.
  weightLogBase: 10,
  weightOffset: 0,
  positiveReacts: ['➕', '🥳', '💡', '🔥', '👏', '🌈'],
  // Applied to every react on top of the reactor's weight (and tip multiplier)
  reactMultiplier: 2,
  tippedReactMultipliers: { '🧡': 2, '🏅': 3, '🏆': 5 } as Record<string, number>,
  // Every live project starts with this much karma, so a new project from an unknown
  // creator gets a brief run near the top of the homepage before the age decay buries it
  projectBaseKarma: 2,
  // project karma += creatorKarmaCoefficient * log10(1 + creator karma)
  creatorKarmaCoefficient: 5,
  // homepage: project karma / (age in days + 1) ^ hotAgeExponent
  hotAgeExponent: 1.7,
  // homepage only: multiplier for projects no longer accepting donations
  // (complete / not funded, or a grant that has reached its funding goal)
  closedProjectMultiplier: 0.2,
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
  funding_goal: number
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
  starting: number
  donationsGiven: number
  donationsReceived: number
  votes: number
  reacts: number
  projectsDonatedTo: number
  voteCount: number
  reactCount: number
  // Absent on rows computed before these were added
  dollarsGiven?: number
  dollarsReceived?: number
}
export type ProjectKarmaBreakdown = {
  base: number
  votes: number
  comments: number
  donations: number
  creator: number
  voteCount: number
  commentCount: number
  donorCount: number
  creatorKarma: number
  raised: number
  acceptingDonations: boolean
}
export type KarmaResult = {
  profiles: Map<string, { karma: number; breakdown: ProfileKarmaBreakdown }>
  projects: Map<string, { karma: number; breakdown: ProjectKarmaBreakdown }>
  iterations: number
  converged: boolean
}

export function karmaWeight(karma: number, config: KarmaConfig = KARMA_CONFIG) {
  if (karma <= 1) return 0
  return Math.max(0, Math.log(karma) / Math.log(config.weightLogBase) - config.weightOffset)
}

export function donationKarma(amount: number, config: KarmaConfig = KARMA_CONFIG) {
  return config.donationScale * Math.max(amount, 0) ** config.donationExponent
}

// Project donation term. Swappable; currently sum over donors of donationKarma(amount).
export function quadraticDonationScore(
  amountByDonor: Map<string, number>,
  _config: KarmaConfig = KARMA_CONFIG
) {
  let score = 0
  for (const amount of amountByDonor.values()) score += donationKarma(amount, _config)
  return score
}

export function projectHotScore(
  karma: number | null | undefined,
  createdAt: string,
  acceptingDonations: boolean,
  now: number = Date.now(),
  config: KarmaConfig = KARMA_CONFIG
) {
  const ageDays = Math.max(0, now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  const multiplier = acceptingDonations ? 1 : config.closedProjectMultiplier
  return ((karma ?? 0) * multiplier) / (ageDays + 1) ** config.hotAgeExponent
}

// Same rule as the project page's DonateBox: open stage, and grants must be under goal.
export function isAcceptingDonations(
  project: Pick<KarmaProjectRow, 'stage' | 'type' | 'funding_goal'>,
  raised: number
) {
  if (project.stage !== 'proposal' && project.stage !== 'active') return false
  return project.type !== 'grant' || raised < project.funding_goal
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

  const raisedByProject = new Map<string, number>()
  for (const bid of inputs.bids) {
    const project = projectById.get(bid.project)
    if (project?.stage === 'proposal' && bid.status === 'pending' && bid.type !== 'sell') {
      raisedByProject.set(bid.project, (raisedByProject.get(bid.project) ?? 0) + bid.amount)
    }
  }
  for (const txn of inputs.txns) {
    const project = txn.project ? projectById.get(txn.project) : undefined
    if (
      project &&
      project.stage !== 'proposal' &&
      txn.token === 'USD' &&
      txn.to_id === project.creator
    ) {
      raisedByProject.set(project.id, (raisedByProject.get(project.id) ?? 0) + txn.amount)
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
        starting: 0,
        donationsGiven: 0,
        donationsReceived: 0,
        votes: 0,
        reacts: 0,
        projectsDonatedTo: 0,
        voteCount: 0,
        reactCount: 0,
        dollarsGiven: 0,
        dollarsReceived: 0,
      }
      breakdowns.set(id, b)
    }
    return b
  }
  const startingTypes = new Set(config.startingKarmaTxnTypes)
  const depositors = new Set(
    inputs.txns.filter((t) => t.type && startingTypes.has(t.type)).map((t) => t.to_id)
  )
  for (const profile of inputs.profiles) {
    ensure(profile.id).starting = depositors.has(profile.id) ? config.startingKarma : 0
  }
  const projectDonors = new Map<string, Map<string, number>>()
  for (const [donor, byProject] of donations) {
    const b = ensure(donor)
    for (const [projectId, d] of byProject) {
      const earlyFraction = d.early / d.total
      b.donationsGiven +=
        donationKarma(d.total, config) * (1 + (config.earlyDonationMultiplier - 1) * earlyFraction)
      b.projectsDonatedTo += 1
      b.dollarsGiven! += d.total
      const received = ensure(projectById.get(projectId)!.creator)
      received.donationsReceived += donationKarma(d.total, config)
      received.dollarsReceived! += d.total
      let donors = projectDonors.get(projectId)
      if (!donors) projectDonors.set(projectId, (donors = new Map()))
      donors.set(donor, (donors.get(donor) ?? 0) + d.total)
    }
  }
  const base = new Map<string, number>()
  for (const [id, b] of breakdowns) {
    base.set(id, b.starting + b.donationsGiven + b.donationsReceived)
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
      base: config.projectBaseKarma,
      votes: 0,
      comments: 0,
      donations: quadraticDonationScore(projectDonors.get(p.id) ?? new Map(), config),
      creator:
        config.creatorKarmaCoefficient *
        Math.log10(1 + Math.max(creatorKarma - (breakdowns.get(p.creator)?.starting ?? 0), 0)),
      voteCount: 0,
      commentCount: 0,
      donorCount: projectDonors.get(p.id)?.size ?? 0,
      creatorKarma,
      raised: raisedByProject.get(p.id) ?? 0,
      acceptingDonations: isAcceptingDonations(p, raisedByProject.get(p.id) ?? 0),
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
    projectResults.set(id, {
      karma: b.base + b.votes + b.comments + b.donations + b.creator,
      breakdown: b,
    })
  }

  return { profiles, projects: projectResults, iterations, converged }
}
