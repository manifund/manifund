import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { SupabaseClient, User } from '@supabase/supabase-js'
import { sortBy } from 'es-toolkit'
import { createPublicSupabaseClient, createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, isAdmin, Profile } from '@/db/profile'
import { BidAndProject } from '@/db/bid'
import { CommentAndProjectAndRxns } from '@/db/comment'
import { FullProject, ProjectSummary } from '@/db/project'
import { Txn, getTxnAndProjectsByUser } from '@/db/txn'
import { getPendingBidsByUser } from '@/db/bid'
import { TARGET_EMBEDS, isListed } from '@/lib/comments/links'
import { withCurrentMentionLabels } from '@/lib/comments/mentions'
import { calculateCashBalance, calculateCharityBalance, calculateUserBalance } from '@/utils/math'
import { fundPath } from '@/utils/funds'

// What a profile's sections read. Everything here is public, so visitors get a copy cached for a minute
// (read with the public client); the owner always reads fresh, with their own client, so their drafts show
// and a deposit they just made is in the balance.

export const PAGE_SIZE = 25
const CACHE_SECONDS = 60
const BANK_ID = '758e68da-c37c-4a9d-a82b-f4aaedde31b9'

// One page of a section, and where the next one starts (null at the end)
export type Page<T> = { items: T[]; next: number | null }

// PostgREST returns at most 1,000 rows a request: read the rest in further pages.
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown }>) {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data } = await query(from, from + PAGE - 1)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

// --- Who is looking ---

// The signed-in viewer, from the session's JWT (no round trip to Supabase Auth when it can be checked locally)
export const getViewer = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  const email = typeof claims.email === 'string' ? claims.email : undefined
  return { id: claims.sub, email, isAdmin: isAdmin({ email } as User) }
})

// The viewer's profile and what they can give from: for the donate box and tipping comments
export const getViewerFunds = cache(async () => {
  const viewer = await getViewer()
  if (!viewer) return { profile: undefined, charityBalance: 0 }
  const supabase = await createServerSupabaseClient()
  const [profile, txns, bids] = await Promise.all([
    getProfileById(supabase, viewer.id),
    getTxnAndProjectsByUser(supabase, viewer.id),
    getPendingBidsByUser(supabase, viewer.id),
  ])
  const charityBalance = profile
    ? calculateCharityBalance(txns, bids, profile.id, profile.accreditation_status)
    : 0
  return { profile, charityBalance }
})

// --- Money: balances, donations, transactions ---

type Party = { username: string; full_name: string; type: Profile['type'] } | null
type LedgerTxn = Txn & {
  projects: ProjectSummary | null
  from_profile: Party
  to_profile: Party
}

export type DonationRow = {
  id: string
  kind: 'project' | 'person' | 'fund' | 'charity'
  name: string
  href: string
  amount: number
  date: string | null // null: an offer still pending
}

export type TxnRow = {
  id: string
  label: string
  href: string | null
  type: string
  date: string
  amount: number
  direction: 'in' | 'out' | 'self'
}

export type Investment = {
  project: ProjectSummary
  numShares: number
  priceUsd: number
}

export type Ledger = {
  balance: number
  cashBalance: number
  charityBalance: number
  pending: number
  gave: { total: number; projects: number; people: number; since: string | null }
  donations: DonationRow[]
  txns: TxnRow[]
  // Old impact-certificate trading, shown under Donations when someone has any
  proposalBids: BidAndProject[]
  activeBids: BidAndProject[]
  investments: Investment[]
}

function partyHref(username: string, type: Profile['type']) {
  if (type === 'fund') return fundPath(username)
  if (type === 'org') return `/charity/${username}`
  return `/${username}`
}

const humanize = (type: string | null) =>
  type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Transaction'

async function buildLedger(
  supabase: SupabaseClient,
  profileId: string,
  accredited: boolean
): Promise<Ledger> {
  const [txns, bids] = await Promise.all([
    readAll<LedgerTxn>((from, to) =>
      supabase
        .from('txns')
        .select(
          '*, projects(id, title, slug, stage, type, creator), from_profile:profiles!txns_from_id_fkey(username, full_name, type), to_profile:profiles!txns_to_id_fkey(username, full_name, type)'
        )
        .or(`from_id.eq.${profileId},to_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
        .throwOnError()
    ),
    readAll<BidAndProject>((from, to) =>
      supabase
        .from('bids')
        .select('*, projects(id, title, slug, stage, type, creator)')
        .eq('bidder', profileId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
        .throwOnError()
    ),
  ])
  const txnsForMath = txns.map((txn) => ({ ...txn, projects: txn.projects ?? undefined }))

  const balance = calculateUserBalance(txns, profileId)
  const cash = calculateCashBalance(txnsForMath, bids, profileId, accredited)
  const charity = calculateCharityBalance(txnsForMath, bids, profileId, accredited)
  // The old accounting system left some cash balances negative: count that against charity.
  const cashBalance = Math.max(cash, 0)
  const charityBalance = charity + Math.min(cash, 0)

  const given = txns.filter(
    (txn) =>
      (txn.type === 'profile donation' || txn.type === 'project donation') &&
      txn.from_id === profileId &&
      txn.to_id !== profileId
  )
  const pendingOffers = bids.filter((bid) => bid.status === 'pending' && bid.type === 'donate')
  const donations: DonationRow[] = [
    ...pendingOffers.map((bid) => ({
      id: bid.id,
      kind: 'project' as const,
      name: bid.projects.title,
      href: `/projects/${bid.projects.slug}#bids`,
      amount: bid.amount,
      date: null,
    })),
    ...given.map((txn): DonationRow => {
      if (txn.projects)
        return {
          id: txn.id,
          kind: 'project',
          name: txn.projects.title,
          href: `/projects/${txn.projects.slug}`,
          amount: txn.amount,
          date: txn.created_at,
        }
      const to = txn.to_profile
      return {
        id: txn.id,
        kind: to?.type === 'fund' ? 'fund' : to?.type === 'org' ? 'charity' : 'person',
        name: to?.full_name || to?.username || 'Someone',
        href: to ? partyHref(to.username, to.type) : '#',
        amount: txn.amount,
        date: txn.created_at,
      }
    }),
  ]

  const txnRows: TxnRow[] = txns
    .filter((txn) => txn.token === 'USD')
    .map((txn) => {
      const direction = txn.from_id === txn.to_id ? 'self' : txn.to_id === profileId ? 'in' : 'out'
      const other = direction === 'in' ? txn.from_profile : txn.to_profile
      const otherId = direction === 'in' ? txn.from_id : txn.to_id
      let label = humanize(txn.type)
      let href: string | null = null
      if (txn.projects) {
        label = txn.projects.title
        href = `/projects/${txn.projects.slug}`
      } else if (otherId === BANK_ID) {
        label = 'Manifund Bank'
      } else if (other && direction !== 'self') {
        label = other.full_name || other.username
        href = partyHref(other.username, other.type)
      }
      return {
        id: txn.id,
        label,
        href,
        type: humanize(txn.type),
        date: txn.created_at,
        amount: txn.amount,
        direction,
      }
    })

  return {
    balance,
    cashBalance,
    charityBalance,
    pending: balance - cash - charity,
    gave: {
      total: given.reduce((sum, txn) => sum + txn.amount, 0),
      projects: new Set(given.filter((txn) => txn.project).map((txn) => txn.project)).size,
      people: new Set(given.filter((txn) => !txn.project).map((txn) => txn.to_id)).size,
      since: given.length > 0 ? given[given.length - 1].created_at : null,
    },
    donations,
    txns: txnRows,
    proposalBids: bids.filter(
      (bid) =>
        bid.projects.stage === 'proposal' && bid.status === 'pending' && bid.type !== 'donate'
    ),
    activeBids: bids.filter((bid) => bid.projects.stage === 'active' && bid.status === 'pending'),
    investments: compileInvestments(txns, profileId).filter(
      (investment) => investment.project.creator !== profileId && investment.numShares !== 0
    ),
  }
}

// Shares bought and what they cost, per project (old impact certificates)
function compileInvestments(txns: LedgerTxn[], userId: string) {
  const byProject = new Map<string, Investment>()
  for (const txn of sortBy(txns, ['created_at'])) {
    if (!txn.projects || !txn.bundle) continue
    const entry = byProject.get(txn.projects.id) ?? {
      project: txn.projects,
      numShares: 0,
      priceUsd: 0,
    }
    const signed = txn.to_id === userId ? txn.amount : -txn.amount
    if (txn.token === 'USD') entry.priceUsd += signed
    else entry.numShares += signed
    byProject.set(txn.projects.id, entry)
  }
  return [...byProject.values()]
}

const ledgerCached = unstable_cache(
  (profileId: string, accredited: boolean) =>
    buildLedger(createPublicSupabaseClient(), profileId, accredited),
  ['profile-ledger-v1'],
  { revalidate: CACHE_SECONDS }
)

export const getLedger = cache(async (profileId: string, accredited: boolean, fresh: boolean) =>
  fresh
    ? buildLedger(await createServerSupabaseClient(), profileId, accredited)
    : ledgerCached(profileId, accredited)
)

// --- Projects ---

const PROJECT_COLUMNS =
  'title, id, created_at, creator, slug, blurb, stage, funding_goal, min_funding, type, approved, signed_agreement, amm_shares, founder_shares, auction_close, ai_fraction, quality_score, karma, karma_breakdown, profiles!projects_creator_fkey(id, username, full_name, avatar_url, type), bids(*), txns(*), comments(id), rounds(title, slug), project_transfers(id, project_id, recipient_name, transferred, created_at), project_votes(magnitude), causes(title, slug), project_ai_evals(score, created_at)'

// Their projects, newest first. Drafts and hidden projects only for the owner (E13); a project being handed to
// someone else isn't theirs to show any more.
async function listProjectIds(supabase: SupabaseClient, profileId: string, isOwn: boolean) {
  const { data } = await supabase
    .from('projects')
    .select('id, stage, project_transfers(transferred)')
    .eq('creator', profileId)
    .order('created_at', { ascending: false })
    .throwOnError()
  return (data ?? [])
    .filter((project) => isOwn || (project.stage !== 'hidden' && project.stage !== 'draft'))
    .filter((project) => !project.project_transfers.some((transfer) => !transfer.transferred))
    .map((project) => project.id)
}

export async function getProjectsByIds(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .in('id', ids)
    .throwOnError()
  const byId = new Map((data as unknown as FullProject[]).map((project) => [project.id, project]))
  return ids.map((id) => byId.get(id)).filter((project): project is FullProject => !!project)
}

async function buildProjects(supabase: SupabaseClient, profileId: string, isOwn: boolean) {
  const ids = await listProjectIds(supabase, profileId, isOwn)
  const first = await getProjectsByIds(supabase, ids.slice(0, PAGE_SIZE))
  return { ids, first }
}

const projectsCached = unstable_cache(
  (profileId: string) => buildProjects(createPublicSupabaseClient(), profileId, false),
  ['profile-projects-v1'],
  { revalidate: CACHE_SECONDS }
)

export const getProfileProjects = cache(async (profileId: string, fresh: boolean) =>
  fresh
    ? buildProjects(await createServerSupabaseClient(), profileId, true)
    : projectsCached(profileId)
)

// --- Comments they wrote (C30): not the ones on profiles, nor on hidden projects ---

export async function getCommentsPage(
  supabase: SupabaseClient,
  profileId: string,
  offset: number
): Promise<Page<CommentAndProjectAndRxns>> {
  const { data } = await supabase
    .from('comments')
    .select(
      `*, ${TARGET_EMBEDS}, comment_rxns(reactor_id, reaction, profiles!comment_rxns_reactor_id_fkey(id, username, avatar_url, full_name))`
    )
    .eq('commenter', profileId)
    .is('profile_id', null)
    .is('deleted_at', null)
    .is('held_at', null)
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + PAGE_SIZE - 1)
    .throwOnError()
  const rows = (data ?? []) as unknown as CommentAndProjectAndRxns[]
  const items = await withCurrentMentionLabels(supabase, rows.filter(isListed))
  return { items, next: rows.length === PAGE_SIZE ? offset + PAGE_SIZE : null }
}

async function countComments(supabase: SupabaseClient, profileId: string) {
  const base = () =>
    supabase
      .from('comments')
      .select('id, projects!inner(stage)', { count: 'exact', head: true })
      .eq('commenter', profileId)
      .is('profile_id', null)
      .is('deleted_at', null)
      .is('held_at', null)
  const [all, hidden] = await Promise.all([
    supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('commenter', profileId)
      .is('profile_id', null)
      .is('deleted_at', null)
      .is('held_at', null),
    base().eq('projects.stage', 'hidden'),
  ])
  return Math.max((all.count ?? 0) - (hidden.count ?? 0), 0)
}

async function buildComments(supabase: SupabaseClient, profileId: string) {
  const [total, first] = await Promise.all([
    countComments(supabase, profileId),
    getCommentsPage(supabase, profileId, 0),
  ])
  return { total, first }
}

const commentsCached = unstable_cache(
  (profileId: string) => buildComments(createPublicSupabaseClient(), profileId),
  ['profile-comments-v1'],
  { revalidate: CACHE_SECONDS }
)

export const getProfileComments = cache(async (profileId: string, fresh: boolean) =>
  fresh ? buildComments(await createServerSupabaseClient(), profileId) : commentsCached(profileId)
)
