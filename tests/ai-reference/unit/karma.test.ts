// Karma's formula and the homepage order (utils/karma.ts): docs/ai-reference/karma/README.md, rules K1-K6 and K10.
// Pure logic: small made-up inputs, no database.
import { describe, expect, test } from 'bun:test'
import {
  computeKarma,
  donationKarma,
  isAcceptingDonations,
  karmaWeight,
  KARMA_CONFIG,
  newProjectKarma,
  projectHotScore,
  type KarmaInputs,
  type KarmaProjectRow,
} from '@/utils/karma'

const BANK = 'bank'
const profile = (id: string) => ({ id, username: id, full_name: id })
const project = (
  id: string,
  creator: string,
  fields: Partial<KarmaProjectRow> = {}
): KarmaProjectRow => ({
  id,
  creator,
  created_at: '2026-10-01T00:00:00Z',
  stage: 'active',
  type: 'grant',
  funding_goal: 1000,
  title: id,
  slug: id,
  ...fields,
})
const inputs = (fields: Partial<KarmaInputs>): KarmaInputs => ({
  profiles: [],
  projects: [],
  votes: [],
  comments: [],
  commentRxns: [],
  bids: [],
  txns: [],
  bankId: BANK,
  ...fields,
})
const deposit = (to: string) => ({
  from_id: BANK,
  to_id: to,
  amount: 100,
  type: 'deposit',
  token: 'USD',
  project: null,
})
const donation = (from: string, to: string, projectId: string, amount: number) => ({
  from_id: from,
  to_id: to,
  amount,
  type: 'project donation',
  token: 'USD',
  project: projectId,
})
const profileKarma = (r: ReturnType<typeof computeKarma>, id: string) =>
  r.profiles.get(id)?.karma ?? 0
const projectKarma = (r: ReturnType<typeof computeKarma>, id: string) =>
  r.projects.get(id)?.karma ?? 0

describe('K1 hidden projects and drafts get no karma and count for nothing', () => {
  test('only live projects are scored; a vote on a draft gives its creator nothing', () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('creator'), profile('voter')],
        projects: [
          project('live', 'creator'),
          project('draft', 'creator', { stage: 'draft' }),
          project('hidden', 'creator', { stage: 'hidden' }),
        ],
        txns: [deposit('voter')],
        votes: [{ voter_id: 'voter', project_id: 'draft', magnitude: 1 }],
      })
    )
    expect([...r.projects.keys()]).toEqual(['live'])
    expect(r.profiles.get('creator')!.breakdown.votes).toBe(0)
  })
})

describe("K2 a person's karma", () => {
  test('starting karma: 10 for anyone who has received a deposit, 0 otherwise', () => {
    const r = computeKarma(inputs({ profiles: [profile('a'), profile('b')], txns: [deposit('a')] }))
    expect(profileKarma(r, 'a')).toBe(10)
    expect(profileKarma(r, 'b')).toBe(0)
  })
  test('donations given and received: 2.5 × total^0.3; the early share counts 1.5× for the giver only', () => {
    const total = 1000
    const r = computeKarma(
      inputs({
        profiles: [profile('donor'), profile('creator')],
        projects: [project('p', 'creator')],
        // Accepted offer of 400 at activation, then 1000 in donation txns: 400 of it early.
        bids: [{ bidder: 'donor', project: 'p', amount: 400, type: 'donate', status: 'accepted' }],
        txns: [donation('donor', 'creator', 'p', 600), donation('donor', 'creator', 'p', 400)],
      })
    )
    const base = 2.5 * total ** 0.3
    expect(r.profiles.get('donor')!.breakdown.donationsGiven).toBeCloseTo(base * (1 + 0.5 * 0.4), 6)
    expect(r.profiles.get('creator')!.breakdown.donationsReceived).toBeCloseTo(base, 6)
    expect(donationKarma(100)).toBeCloseTo(2.5 * 100 ** 0.3, 9)
    expect(donationKarma(-5)).toBe(0)
  })
  test("votes on their projects: direction × the voter's weight", () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('creator'), profile('up'), profile('down')],
        projects: [project('p', 'creator')],
        txns: [deposit('up'), deposit('down')],
        votes: [
          { voter_id: 'up', project_id: 'p', magnitude: 1 },
          { voter_id: 'down', project_id: 'p', magnitude: -1 },
        ],
      })
    )
    // Both voters have 10 karma (a deposit), weight 1: +1 - 1.
    expect(r.profiles.get('creator')!.breakdown.votes).toBeCloseTo(0, 9)
    expect(r.profiles.get('creator')!.breakdown.voteCount).toBe(2)
  })
  test('reactions to their comments: weight × 2, tipped ones ×2/×3/×5 on top', () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('author'), profile('fan')],
        projects: [project('p', 'someone')],
        comments: [{ id: 'c', commenter: 'author', project: 'p' }],
        txns: [deposit('fan')],
        commentRxns: [
          { comment_id: 'c', reactor_id: 'fan', reaction: '🔥', txn_id: null },
          { comment_id: 'c', reactor_id: 'fan', reaction: '🏆', txn_id: 'tip' },
        ],
      })
    )
    // fan weighs 1: 🔥 = 1 × 2, tipped 🏆 = 1 × 2 × 5.
    expect(r.profiles.get('author')!.breakdown.reacts).toBeCloseTo(2 + 10, 9)
  })
})

describe('K3 what counts as a donation', () => {
  test("a pending offer on a proposal counts in full and as early; bank, self and own-project money doesn't", () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('donor'), profile('creator')],
        projects: [project('prop', 'creator', { stage: 'proposal' }), project('act', 'creator')],
        bids: [
          { bidder: 'donor', project: 'prop', amount: 100, type: 'donate', status: 'pending' },
          { bidder: 'creator', project: 'prop', amount: 100, type: 'donate', status: 'pending' },
        ],
        txns: [
          { ...donation(BANK, 'creator', 'act', 500), from_id: BANK },
          donation('creator', 'creator', 'act', 500),
        ],
      })
    )
    expect(r.profiles.get('donor')!.breakdown.donationsGiven).toBeCloseTo(
      donationKarma(100) * 1.5,
      6
    )
    expect(r.profiles.get('creator')!.breakdown.donationsGiven).toBe(0)
    expect(r.projects.get('act')!.breakdown.donations).toBe(0)
    expect(r.projects.get('prop')!.breakdown.donorCount).toBe(1)
  })
})

describe('K4 weight = log10(karma), 0 at 1 or less; computed together until it settles', () => {
  test('weights', () => {
    expect(karmaWeight(0)).toBe(0)
    expect(karmaWeight(1)).toBe(0)
    expect(karmaWeight(-50)).toBe(0)
    expect(karmaWeight(10)).toBeCloseTo(1, 9)
    expect(karmaWeight(100)).toBeCloseTo(2, 9)
    expect(karmaWeight(1000)).toBeCloseTo(3, 9)
    expect(karmaWeight(5)).toBeCloseTo(Math.log10(5), 9)
  })
  test('a voter with no karma weighs nothing; the result converges', () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('creator'), profile('newcomer')],
        projects: [project('p', 'creator')],
        votes: [{ voter_id: 'newcomer', project_id: 'p', magnitude: 1 }],
      })
    )
    expect(profileKarma(r, 'creator')).toBe(0)
    expect(r.converged).toBe(true)
    expect(r.iterations).toBeLessThanOrEqual(KARMA_CONFIG.maxIterations)
  })
  test('weights feed back: votes between two people raise both until the change is under 0.01', () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('a'), profile('b')],
        projects: [project('pa', 'a'), project('pb', 'b')],
        txns: [deposit('a'), deposit('b')],
        votes: [
          { voter_id: 'a', project_id: 'pb', magnitude: 1 },
          { voter_id: 'b', project_id: 'pa', magnitude: 1 },
        ],
      })
    )
    const a = profileKarma(r, 'a')
    expect(r.converged).toBe(true)
    // Fixed point: a = 10 + log10(b), b = a by symmetry.
    expect(a).toBeCloseTo(10 + Math.log10(a), 1)
    expect(profileKarma(r, 'b')).toBeCloseTo(a, 6)
  })
})

describe('K5 nothing counts for oneself', () => {
  test('own votes, comments on own projects and reactions to own comments count for nothing; negative reactions neither', () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('me'), profile('other')],
        projects: [project('mine', 'me')],
        txns: [deposit('me'), deposit('other')],
        votes: [{ voter_id: 'me', project_id: 'mine', magnitude: 1 }],
        comments: [
          { id: 'c1', commenter: 'me', project: 'mine' },
          { id: 'c2', commenter: 'other', project: 'mine' },
        ],
        commentRxns: [
          { comment_id: 'c1', reactor_id: 'me', reaction: '🔥', txn_id: null },
          { comment_id: 'c2', reactor_id: 'me', reaction: '👎', txn_id: null },
        ],
      })
    )
    expect(r.profiles.get('me')!.breakdown.votes).toBe(0)
    expect(r.profiles.get('me')!.breakdown.reacts).toBe(0)
    expect(r.profiles.get('other')!.breakdown.reacts).toBe(0)
    expect(r.projects.get('mine')!.breakdown.voteCount).toBe(0)
    expect(r.projects.get('mine')!.breakdown.commentCount).toBe(1)
  })
})

describe("K6 a project's karma", () => {
  test("base 2 + 5 × log10(1 + creator karma) + votes + others' comments + donations", () => {
    const r = computeKarma(
      inputs({
        profiles: [profile('creator'), profile('fan')],
        projects: [project('p', 'creator')],
        txns: [deposit('creator'), deposit('fan'), donation('fan', 'creator', 'p', 100)],
        votes: [{ voter_id: 'fan', project_id: 'p', magnitude: 1 }],
        comments: [{ id: 'c', commenter: 'fan', project: 'p' }],
      })
    )
    const b = r.projects.get('p')!.breakdown
    const fanWeight = karmaWeight(profileKarma(r, 'fan'))
    expect(b.base).toBe(2)
    expect(b.creator).toBeCloseTo(5 * Math.log10(1 + profileKarma(r, 'creator')), 6)
    expect(b.votes).toBeCloseTo(fanWeight, 6)
    expect(b.comments).toBeCloseTo(fanWeight, 6)
    expect(b.donations).toBeCloseTo(donationKarma(100), 6)
    expect(projectKarma(r, 'p')).toBeCloseTo(
      b.base + b.creator + b.votes + b.comments + b.donations,
      6
    )
  })
  test('a new project starts with the base and the creator term', () => {
    expect(newProjectKarma(0).karma).toBe(2)
    expect(newProjectKarma(99).karma).toBeCloseTo(2 + 5 * Math.log10(100), 9)
    expect(newProjectKarma(-3).karma).toBe(2)
  })
})

describe("K10 the homepage's hot order", () => {
  const now = new Date('2026-10-11T00:00:00Z').getTime()
  test('karma ÷ (age in days + 1)^1.7', () => {
    expect(projectHotScore(100, '2026-10-11T00:00:00Z', true, now)).toBeCloseTo(100, 9)
    expect(projectHotScore(100, '2026-10-10T00:00:00Z', true, now)).toBeCloseTo(100 / 2 ** 1.7, 9)
    expect(projectHotScore(null, '2026-10-10T00:00:00Z', true, now)).toBe(0)
    // A project dated in the future counts as age 0.
    expect(projectHotScore(100, '2026-10-12T00:00:00Z', true, now)).toBeCloseTo(100, 9)
  })
  test('projects no longer taking donations count 0.2× here', () => {
    expect(projectHotScore(100, '2026-10-11T00:00:00Z', false, now)).toBeCloseTo(20, 9)
  })
  test('taking donations: proposals and active projects, and a grant only under its goal', () => {
    const grant = { stage: 'active', type: 'grant', funding_goal: 1000 }
    expect(isAcceptingDonations(grant, 999)).toBe(true)
    expect(isAcceptingDonations(grant, 1000)).toBe(false)
    expect(isAcceptingDonations({ ...grant, stage: 'proposal' }, 0)).toBe(true)
    expect(isAcceptingDonations({ ...grant, stage: 'complete' }, 0)).toBe(false)
    expect(isAcceptingDonations({ ...grant, stage: 'not funded' }, 0)).toBe(false)
    expect(isAcceptingDonations({ ...grant, type: 'cert' }, 5000)).toBe(true)
  })
})
