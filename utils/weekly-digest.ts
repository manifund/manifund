import { SupabaseClient } from '@supabase/supabase-js'
import { FullProject } from '@/db/project'
import { sendEmail, sendBatchEmail } from './email'
import { getAmountRaised } from './math'
import { formatMoney } from './formatting'
import { getUserEmail } from './email'
import { getSponsoredAmount } from './constants'
import { toPlaintext } from './tiptap-parsing'
import { aiRankingScore } from './karma'
import { pointScore } from './sort'
import {
  closesAt,
  DIGEST_PROJECT_RULES,
  selectHighlyRatedStillRaising,
  selectNewProjects,
} from './digest-projects'
import { NOTABLE_COMMENT_RULES, notableCommentScore } from './notable-comments'

/* TODOs:
- [x] Pull out regrantor emails from Supabase
- [x] Sort by "great" score
- [x] Add comments section with regrantor comments and top emoji reactions
- [x] Pull out large donor emails from Supabase
- [x] Send out batch emails on batch endpoint
- [ ] Prettify email, rename
- [x] Simplify code & payload
*/

interface NotableComment {
  id: string
  content: any
  commenter: string
  profiles?: { username?: string; full_name?: string }
  projects?: { title?: string; slug?: string }
  comment_rxns?: Array<{ reaction: string }>
  reactionCounts: Record<string, number>
  totalScore: number
  isRegrantor: boolean
}

interface NotableGrant {
  id: string
  amount: number
  // Bids are pledges to proposal-stage projects; donations are completed txns
  // to active projects. Both count as notable grants. A donor's grants to one
  // project in the week are combined; 'mixed' means some of each.
  kind: 'bid' | 'donation' | 'mixed'
  donorId: string
  projectId: string
  createdAt: string
  profiles?: { username?: string; full_name?: string }
  projects?: { title?: string; slug?: string }
  isRegrantor: boolean
}

interface WeekRange {
  weekStart: string
  weekEnd: string
}

// Constants
const DEFAULT_DIGEST_RECIPIENTS = [
  'austin@manifund.org',
  'rachel.weinberg12@gmail.com',
  // Add more emails here as needed
]

const NOTABLE_GRANT_THRESHOLD = 1000
const LARGE_DONOR_THRESHOLD = 1000

const EMAIL_STYLES = `
  body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
  .container { background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 768px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; }
  .header h1 { color: #2c3e50; margin: 0; font-size: 28px; }
  .header p { color: #7f8c8d; margin: 5px 0 0 0; font-size: 14px; }
  .section { margin: 20px 0; }
  .section-header { margin: 25px 0 15px 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
  .section-header h2 { color: #2c3e50; margin: 0; font-size: 20px; }
  .item { padding: 15px 0; }
  .title { font-weight: bold; color: #2c3e50; font-size: 16px; margin-bottom: 5px; }
  .title a { color: #ea580c; font-weight: bold; }
  .creator { color: #7f8c8d; font-weight: 500; }
  .name { color: #000; font-weight: 500; }
  .amount { color: #000; font-weight: 600; }
  .gray-text { color: #7f8c8d; }
  .summary { color: #555; margin: 8px 0; font-size: 14px; }
  .stats { font-size: 13px; color: #7f8c8d; margin-top: 8px; }
  .stats span { display: inline-block; margin-right: 15px; }
  .content { color: #555; font-size: 14px; margin: 5px 0; }
  .content a { color: #ea580c; text-decoration: none !important; }
  .reactions { font-size: 12px; color: #7f8c8d; margin-top: 5px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #7f8c8d; }
  .footer a { color: #3498db; text-decoration: none; }
  .cta-button { display: inline-block; padding: 12px 25px; background-color: #ea580c; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
  .no-projects { text-align: center; color: #7f8c8d; font-style: italic; padding: 20px; }
`

// Utility functions
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getDisplayName = (profile?: { full_name?: string; username?: string }): string =>
  profile?.full_name || profile?.username || 'Anonymous'

const formatWeekRange = (): WeekRange => {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }

  return {
    weekStart: oneWeekAgo.toLocaleDateString('en-US', options),
    weekEnd: now.toLocaleDateString('en-US', options),
  }
}

const getOneWeekAgo = (): Date => {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date
}

// Supabase's PostgREST rejects an `.in(col, ids)` once the id list makes the
// request URL too long, returning a "Bad Request"
// error rather than the rows. Split large id lists into batches to avoid errors.
const IN_CHUNK_SIZE = 200

async function selectByIdsChunked<Row>(
  ids: string[],
  runChunk: (
    chunk: string[]
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
): Promise<Row[]> {
  const rows: Row[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const { data, error } = await runChunk(ids.slice(i, i + IN_CHUNK_SIZE))
    if (error) throw new Error(`weekly digest chunked query failed: ${error.message}`)
    if (data) rows.push(...data)
  }
  return rows
}

// Data fetching functions
export async function getRegrantorEmails(
  supabase: SupabaseClient,
  year?: number
): Promise<string[]> {
  const { data: regrantors } = await supabase
    .from('profiles')
    .select('id')
    .eq('regranter_status', true)
    .throwOnError()

  if (!regrantors?.length) return []

  const filteredRegrantors = year
    ? regrantors.filter((r) => getSponsoredAmount(r.id, year) > 0)
    : regrantors

  const emails = await Promise.all(filteredRegrantors.map((r) => getUserEmail(supabase, r.id)))

  return Array.from(new Set(emails.filter((email): email is string => email !== null)))
}

const PROJECT_FIELDS = `
  *,
  profiles!projects_creator_fkey(*),
  rounds(title, slug),
  causes(title, slug),
  project_ai_evals(score, created_at)
`

// Adds the votes, comments, bids and txns the cards and ranking need
async function hydrateProjects(
  supabase: SupabaseClient,
  projectsBase: any[]
): Promise<FullProject[]> {
  if (!projectsBase.length) return []
  const projectIds = projectsBase.map((p) => p.id)
  const [votes, comments, bids, txns] = await Promise.all([
    selectByIdsChunked(projectIds, (chunk) =>
      supabase.from('project_votes').select('project_id, magnitude').in('project_id', chunk)
    ),
    selectByIdsChunked(projectIds, (chunk) =>
      supabase.from('comments').select('project, id').in('project', chunk)
    ),
    selectByIdsChunked(projectIds, (chunk) =>
      supabase.from('bids').select('*').in('project', chunk)
    ),
    selectByIdsChunked(projectIds, (chunk) =>
      supabase.from('txns').select('*').in('project', chunk)
    ),
  ])
  return projectsBase.map((project) => ({
    ...project,
    project_votes: votes.filter((v) => v.project_id === project.id),
    comments: comments.filter((c) => c.project === project.id),
    bids: bids.filter((b) => b.project === project.id),
    txns: txns.filter((t) => t.project === project.id),
    project_transfers: [],
    project_follows: [],
  }))
}

// Proposals rated 4-5 still short of their minimum, in their first week or the week before they close
export async function getHighlyRatedStillRaising(supabase: SupabaseClient): Promise<FullProject[]> {
  const { data } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('stage', 'proposal')
    .throwOnError()
  const rated = (data ?? []).filter(
    (p: any) =>
      (aiRankingScore(p.project_ai_evals) ?? 0) >= DIGEST_PROJECT_RULES.highlyRatedMinScore
  )
  return selectHighlyRatedStillRaising(await hydrateProjects(supabase, rated), Date.now())
}

// The week's new projects, ranked by karma plus the AI head start
export async function getNewProjectsLastWeek(
  supabase: SupabaseClient,
  excludeIds = new Set<string>()
): Promise<FullProject[]> {
  const { data } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .gte('created_at', getOneWeekAgo().toISOString())
    .throwOnError()
  return selectNewProjects(await hydrateProjects(supabase, data ?? []), Date.now(), excludeIds)
}

export async function getNotableCommentsLastWeek(
  supabase: SupabaseClient,
  limit = NOTABLE_COMMENT_RULES.limit
): Promise<NotableComment[]> {
  const oneWeekAgo = getOneWeekAgo()

  const [{ data: regrantors }, { data: comments }] = await Promise.all([
    supabase.from('profiles').select('id').eq('regranter_status', true).throwOnError(),
    supabase
      .from('comments')
      .select(
        `
      *,
      profiles!comments_commenter_fkey(id, username, full_name, avatar_url, karma),
      projects(id, title, slug, stage),
      comment_rxns(reactor_id, reaction, txn_id)
    `
      )
      .gte('created_at', oneWeekAgo.toISOString())
      .not('project', 'is', null) // the digest is about project comments
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .throwOnError(),
  ])

  // An embedded filter can't drop the parent row, so comments on hidden projects are dropped here
  const live = (comments ?? []).filter((c) => c.projects && c.projects.stage !== 'hidden')
  if (!live.length) return []

  const reactorIds = Array.from(
    new Set(live.flatMap((c) => (c.comment_rxns ?? []).map((r: any) => r.reactor_id as string)))
  )
  const reactors = await selectByIdsChunked<{ id: string; karma: number }>(reactorIds, (chunk) =>
    supabase.from('profiles').select('id, karma').in('id', chunk)
  )
  const karmaById = new Map(reactors.map((r) => [r.id, r.karma]))
  const regrantorIds = new Set(regrantors?.map((r) => r.id) || [])

  const scored = live.flatMap((comment) => {
    const reactions = comment.comment_rxns || []
    const totalScore = notableCommentScore({
      commenter: comment.commenter,
      commenterKarma: comment.profiles?.karma ?? 0,
      replyingTo: comment.replying_to,
      specialType: comment.special_type,
      textLength: toPlaintext(comment.content).trim().length,
      reactions: reactions.map((r: any) => ({
        reactorId: r.reactor_id,
        reactorKarma: karmaById.get(r.reactor_id) ?? 0,
        reaction: r.reaction,
        tipped: !!r.txn_id,
      })),
    })
    if (totalScore === null) return []
    const reactionCounts: Record<string, number> = {}
    reactions.forEach((rxn: any) => {
      reactionCounts[rxn.reaction] = (reactionCounts[rxn.reaction] || 0) + 1
    })
    return [
      { ...comment, reactionCounts, totalScore, isRegrantor: regrantorIds.has(comment.commenter) },
    ]
  })

  return scored.sort((a, b) => b.totalScore - a.totalScore).slice(0, limit)
}

export async function getNotableGrantsLastWeek(
  supabase: SupabaseClient,
  limit = 15
): Promise<NotableGrant[]> {
  const oneWeekAgo = getOneWeekAgo()

  const [{ data: regrantors }, { data: bids }, { data: donations }] = await Promise.all([
    supabase.from('profiles').select('id').eq('regranter_status', true).throwOnError(),
    supabase
      .from('bids')
      .select(
        `
      id, amount, bidder, project, created_at, status,
      profiles!bids_bidder_fkey(id, username, full_name, avatar_url),
      projects(id, title, slug, stage)
    `
      )
      .neq('status', 'deleted')
      .gte('created_at', oneWeekAgo.toISOString())
      .not('project', 'is', null) // the digest is about project comments
      .neq('projects.stage', 'hidden')
      .order('created_at', { ascending: false })
      .throwOnError(),
    // Donations to active projects don't create bids; they land directly in txns
    supabase
      .from('txns')
      .select(
        `
      id, amount, from_id, project, created_at,
      profiles!txns_from_id_fkey(id, username, full_name, avatar_url),
      projects(id, title, slug, stage)
    `
      )
      .eq('type', 'project donation')
      .eq('token', 'USD')
      .not('project', 'is', null)
      .not('from_id', 'is', null)
      .gte('created_at', oneWeekAgo.toISOString())
      .not('project', 'is', null) // the digest is about project comments
      .neq('projects.stage', 'hidden')
      .order('created_at', { ascending: false })
      .throwOnError(),
  ])

  const regrantorIds = new Set(regrantors?.map((r) => r.id) || [])

  // When a proposal activates, each pending bid is marked accepted and a
  // matching txn is inserted (see activate_grant). That txn carries no link
  // back to its bid, so match on (bidder, project, amount) against accepted
  // bids for these projects, and drop matched donations. Each grant is then
  // announced exactly once, in the week the money was committed.
  const donationProjectIds = Array.from(
    new Set((donations ?? []).map((txn: any) => txn.project as string))
  )
  const acceptedBids = await selectByIdsChunked<{
    bidder: string
    project: string
    amount: number
    created_at: string
  }>(donationProjectIds, (chunk) =>
    supabase
      .from('bids')
      .select('bidder, project, amount, created_at')
      .in('project', chunk)
      .eq('status', 'accepted')
  )
  // Match over each project's whole donation history, oldest first: a bid converted in an
  // earlier week must not claim a later, unrelated donation of the same amount.
  const allDonations = await selectByIdsChunked<{
    id: string
    from_id: string
    project: string
    amount: number
    created_at: string
  }>(donationProjectIds, (chunk) =>
    supabase
      .from('txns')
      .select('id, from_id, project, amount, created_at')
      .in('project', chunk)
      .eq('type', 'project donation')
      .eq('token', 'USD')
  )
  const unmatchedBids = [...acceptedBids]
  const convertedTxnIds = new Set<string>()
  for (const txn of allDonations.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const idx = unmatchedBids.findIndex(
      (bid) =>
        bid.bidder === txn.from_id &&
        bid.project === txn.project &&
        bid.amount === txn.amount &&
        bid.created_at <= txn.created_at
    )
    if (idx === -1) continue
    unmatchedBids.splice(idx, 1)
    convertedTxnIds.add(txn.id)
  }
  const isConvertedBid = (txn: any) => convertedTxnIds.has(txn.id)

  const grants: NotableGrant[] = [
    ...(bids ?? []).map((bid: any) => ({
      id: bid.id,
      amount: bid.amount,
      // An accepted bid has already turned into a donation; say so
      kind: (bid.status === 'accepted' ? 'donation' : 'bid') as NotableGrant['kind'],
      createdAt: bid.created_at,
      donorId: bid.bidder,
      projectId: bid.project,
      profiles: bid.profiles ?? undefined,
      projects: bid.projects ?? undefined,
      isRegrantor: regrantorIds.has(bid.bidder),
    })),
    ...(donations ?? [])
      .filter((txn: any) => !isConvertedBid(txn))
      .map((txn: any) => ({
        id: txn.id,
        amount: txn.amount,
        kind: 'donation' as const,
        createdAt: txn.created_at,
        donorId: txn.from_id,
        projectId: txn.project,
        profiles: txn.profiles ?? undefined,
        projects: txn.projects ?? undefined,
        isRegrantor: regrantorIds.has(txn.from_id),
      })),
  ]

  // One line per donor and project, with the week's total
  const combined = new Map<string, NotableGrant>()
  for (const grant of grants) {
    const key = `${grant.donorId}:${grant.projectId}`
    const prev = combined.get(key)
    combined.set(
      key,
      prev
        ? {
            ...prev,
            amount: prev.amount + grant.amount,
            kind: prev.kind === grant.kind ? prev.kind : 'mixed',
            createdAt: prev.createdAt > grant.createdAt ? prev.createdAt : grant.createdAt,
          }
        : grant
    )
  }

  return Array.from(combined.values())
    .filter((grant) => grant.isRegrantor || grant.amount >= NOTABLE_GRANT_THRESHOLD)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

export async function getLargeDonorsEmails(
  supabase: SupabaseClient,
  minAmount = LARGE_DONOR_THRESHOLD
): Promise<string[]> {
  const { data: txns } = await supabase
    .from('txns')
    .select('*')
    .eq('token', 'USD')
    .eq('type', 'deposit')
    .throwOnError()

  if (!txns?.length) return []

  const donatedByUserId: Record<string, number> = {}
  txns.forEach((txn) => {
    donatedByUserId[txn.to_id] = (donatedByUserId[txn.to_id] || 0) + txn.amount
  })

  const largeDonorIds = Object.entries(donatedByUserId)
    .filter(([_, amount]) => amount >= minAmount)
    .map(([userId]) => userId)

  if (!largeDonorIds.length) return []

  const profiles = await selectByIdsChunked<{ id: string }>(largeDonorIds, (chunk) =>
    supabase.from('profiles').select('id').in('id', chunk).eq('regranter_status', false)
  )

  if (!profiles.length) return []

  const emails = await Promise.all(profiles.map((p) => getUserEmail(supabase, p.id)))
  return Array.from(new Set(emails.filter((email): email is string => email !== null)))
}

// This is about the top 150 projects
const TOP_CREATOR_MIN_SCORE = 40

export async function getTopCreatorEmails(
  supabase: SupabaseClient,
  minScore = TOP_CREATOR_MIN_SCORE
): Promise<string[]> {
  const { data: projects } = await supabase
    .from('projects')
    .select(
      `
      id, title, creator, created_at, stage, type, funding_goal,
      profiles!projects_creator_fkey(id, full_name, username),
      project_votes(magnitude),
      comments(id),
      bids(amount, status, type),
      txns(amount, type, token, to_id)
    `
    )
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .throwOnError()

  if (!projects?.length) return []

  const scored = projects
    .map((p) => ({
      creatorId: p.creator,
      score: pointScore(p as any),
    }))
    .filter((p) => p.score >= minScore)
    .sort((a, b) => b.score - a.score)

  const topCreatorIds = Array.from(new Set(scored.map((p) => p.creatorId)))

  const users = await selectByIdsChunked<{ email: string | null }>(topCreatorIds, (chunk) =>
    supabase.from('users').select('email').in('id', chunk)
  )

  return users.map((u) => u.email).filter((email): email is string => email !== null)
}

// Content generation functions
// A card like the homepage's ProjectCard, in inline styles and tables so email clients keep it
const generateProjectCard = (project: FullProject, showClose = false): string => {
  const url = `https://manifund.org/projects/${escapeHtml(project.slug)}`
  const name = getDisplayName(project.profiles)
  const raised = getAmountRaised(project, project.bids, project.txns)
  const goal = project.funding_goal
  const percent = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0
  const showBar = project.stage === 'proposal' || project.stage === 'active'
  const avatarUrl = (project.profiles as { avatar_url?: string | null } | undefined)?.avatar_url
  const avatar = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" width="24" height="24" alt="" style="display:inline-block;width:24px;height:24px;border-radius:12px;vertical-align:middle;object-fit:cover;" />`
    : `<span style="display:inline-block;width:24px;height:24px;border-radius:12px;background:#ffedd5;color:#c2410c;font-size:12px;font-weight:600;line-height:24px;text-align:center;vertical-align:middle;">${escapeHtml(name.charAt(0).toUpperCase())}</span>`
  const causes = (project.causes ?? [])
    .map(
      (c) =>
        `<span style="display:inline-block;margin:0 4px 4px 0;padding:0 8px;border-radius:999px;background:#f3f4f6;color:#1f2937;font-size:12px;font-weight:300;line-height:20px;white-space:nowrap;">${escapeHtml(c.title)}</span>`
    )
    .join('')
  const bar = showBar
    ? `<div style="height:6px;border-radius:999px;background:#e5e7eb;margin:8px 0 6px;"><div style="height:6px;width:${percent > 0 ? Math.max(percent, 1.5) : 0}%;border-radius:999px;background:#f97316;"></div></div>`
    : ''
  const close = closesAt(project)
  const closing =
    showClose && close
      ? ` · closes ${new Date(close).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}`
      : ''
  const money = `${formatMoney(raised)}${project.stage === 'proposal' ? ` / ${formatMoney(goal)}` : ' raised'}${closing}`
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:10px 16px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;color:#374151;">${avatar}&nbsp;&nbsp;<span style="vertical-align:middle;">${escapeHtml(name)}</span></td>
          <td align="right" style="font-size:14px;font-weight:600;color:#c2410c;white-space:nowrap;">&#9733; ${Math.round(project.karma ?? 0)}</td>
        </tr></table>
        <a href="${url}" style="display:block;margin:10px 0 2px;color:#111827;font-size:18px;font-weight:500;line-height:1.25;letter-spacing:-0.01em;text-decoration:none;">${escapeHtml(project.title)}</a>
        ${project.blurb ? `<div style="margin:0 0 8px;color:#6b7280;font-size:14px;font-weight:300;line-height:1.4;">${escapeHtml(project.blurb)}</div>` : ''}
        ${causes ? `<div style="margin:4px 0 0;">${causes}</div>` : ''}
        ${bar}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;color:#9ca3af;"><a href="${url}#tabs" style="color:#9ca3af;text-decoration:none;">&#128172; ${project.comments.length}</a></td>
          <td align="right" style="font-size:14px;color:#9ca3af;">${money}</td>
        </tr></table>
      </td></tr>
    </table>
  `
}

const COMMENT_PREVIEW_CHARS = 600

// Cut at a word boundary so previews don't end mid-word
const previewText = (text: string) => {
  if (text.length <= COMMENT_PREVIEW_CHARS) return text
  const cut = text.slice(0, COMMENT_PREVIEW_CHARS)
  const words = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)
  return words.replace(/[\s,;:.\-–—]+$/, '') + '…'
}

const commentUrl = (comment: NotableComment) =>
  `https://manifund.org/projects/${comment.projects?.slug || ''}?tab=comments#${comment.id}`

const generateCommentItem = (comment: NotableComment): string => {
  const commenterName = getDisplayName(comment.profiles)
  const projectTitle = comment.projects?.title || 'Unknown Project'
  const projectSlug = comment.projects?.slug || ''
  const commentText = previewText(toPlaintext(comment.content).trim())

  const reactionHtml = Object.entries(comment.reactionCounts)
    .map(([emoji, count]) => `${emoji}${(count as number) > 1 ? count : ''}`)
    .join(' ')

  return `
    <div class="item">
      <div class="content">
        <span class="name">${escapeHtml(commenterName)}${comment.isRegrantor ? ' ⭐️' : ''}</span>
        <span class="gray-text"> on <a href="https://manifund.org/projects/${escapeHtml(
          projectSlug
        )}">${escapeHtml(projectTitle)}</a></span>
      </div>
      <div class="summary">${escapeHtml(commentText)}</div>
      <div class="reactions">${reactionHtml ? `${reactionHtml}&nbsp;&nbsp;·&nbsp;&nbsp;` : ''}<a href="${escapeHtml(
        commentUrl(comment)
      )}" style="color:#ea580c;text-decoration:none;">View comment</a></div>
    </div>
  `
}

const GRANT_VERBS: Record<NotableGrant['kind'], string> = {
  donation: 'donated',
  bid: 'offered',
  mixed: 'offered and donated',
}
const grantVerb = (grant: NotableGrant) => GRANT_VERBS[grant.kind]

const generateGrantItem = (grant: NotableGrant): string => {
  const bidderName = getDisplayName(grant.profiles)
  const projectTitle = grant.projects?.title || 'Unknown Project'
  const projectSlug = grant.projects?.slug || ''

  return `
    <div class="item">
      <div class="content">
        <span class="name">${escapeHtml(bidderName)}${
          grant.isRegrantor ? ' ⭐️' : ''
        }</span> ${grantVerb(grant)} <span class="amount">$${grant.amount.toLocaleString()}</span> to 
        <span><a href="https://manifund.org/projects/${escapeHtml(
          projectSlug
        )}">${escapeHtml(projectTitle)}</a></span>
      </div>
    </div>
  `
}

const generateSection = (
  title: string,
  items: any[],
  itemGenerator: (item: any) => string
): string => {
  if (!items.length) return ''

  return `
    <div class="section">
      <div class="section-header">
        <h2>${title}</h2>
      </div>
      ${items.map(itemGenerator).join('')}
    </div>
  `
}

const generatePlaintextSection = (
  title: string,
  items: any[],
  itemGenerator: (item: any) => string
): string => {
  if (!items.length) return ''

  return `\n${title}:\n\n${items.map(itemGenerator).join('')}`
}

// Main generation functions
const generateCardsSection = (title: string, cards: string) => `
    <div class="section">
      <div class="section-header">
        <h2>${title}</h2>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:12px;">${cards}</div>
    </div>
  `

export function generateHtmlDigest(
  projects: FullProject[],
  notableComments: NotableComment[] = [],
  notableGrants: NotableGrant[] = [],
  highlyRated: FullProject[] = []
): string {
  const { weekStart, weekEnd } = formatWeekRange()

  const highlyRatedSection = highlyRated.length
    ? generateCardsSection(
        'Highly rated, still raising',
        highlyRated.map((p) => generateProjectCard(p, true)).join('')
      )
    : ''
  const newSection = projects.length
    ? generateCardsSection('New this week', projects.map((p) => generateProjectCard(p)).join(''))
    : '<div class="no-projects">No new projects stood out this week.</div>'
  const projectsSection = `
      ${highlyRatedSection}
      ${newSection}
      <div style="text-align: center;">
        <a href="https://manifund.org/projects" class="cta-button">View all projects</a>
      </div>
    `

  const commentsSection = generateSection('Notable Comments', notableComments, generateCommentItem)
  const grantsSection = generateSection('Notable Grants', notableGrants, generateGrantItem)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manifund: Weekly Digest</title>
    <style>${EMAIL_STYLES}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Manifund: Weekly Digest</h1>
            <p>${weekStart} - ${weekEnd}</p>
        </div>
        ${projectsSection}
        ${grantsSection}
        ${commentsSection}
        <div class="footer">
            <p>Not interested? <a href="{{{ pm:unsubscribe }}}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
  `
}

export function generatePlaintextDigest(
  projects: FullProject[],
  notableComments: NotableComment[] = [],
  notableGrants: NotableGrant[] = [],
  highlyRated: FullProject[] = []
): string {
  const { weekStart, weekEnd } = formatWeekRange()

  let text = `Manifund: Weekly Digest\n${weekStart} - ${weekEnd}\n\n`
  const projectLine = (project: FullProject) => {
    const creatorName = getDisplayName(project.profiles)
    const summary = project.blurb ? ` - ${project.blurb}` : ''
    return `- ${project.title}, by ${creatorName}${summary} https://manifund.org/projects/${project.slug}\n`
  }

  if (highlyRated.length > 0) {
    text += 'Highly rated, still raising:\n\n' + highlyRated.map(projectLine).join('') + '\n'
  }
  if (projects.length === 0) {
    text += 'No new projects stood out this week.\n'
  } else {
    text += 'New this week:\n\n' + projects.map(projectLine).join('')
  }

  text += generatePlaintextSection('Notable comments this week', notableComments, (comment) => {
    const commenterName = getDisplayName(comment.profiles)
    const projectTitle = comment.projects?.title || 'Unknown Project'
    const commentText = previewText(toPlaintext(comment.content).trim())
    const reactionText = Object.entries(comment.reactionCounts)
      .map(([emoji, count]) => `${emoji}${(count as number) > 1 ? count : ''}`)
      .join(' ')
    return `- ${commenterName}${
      comment.isRegrantor ? ' ⭐️' : ''
    } on "${projectTitle}": ${commentText} ${reactionText} ${commentUrl(comment)}\n`
  })

  text += generatePlaintextSection('Notable grants this week', notableGrants, (grant) => {
    const bidderName = getDisplayName(grant.profiles)
    const projectTitle = grant.projects?.title || 'Unknown Project'
    return `- ${bidderName}${
      grant.isRegrantor ? ' ⭐️' : ''
    } ${grantVerb(grant)} $${grant.amount.toLocaleString()} to ${projectTitle}\n`
  })

  return text
}

// Main function
export async function sendWeeklyDigest(supabase: SupabaseClient): Promise<void> {
  console.log('Starting weekly digest generation...')

  const highlyRated = await getHighlyRatedStillRaising(supabase)
  const [projects, notableComments, notableGrants] = await Promise.all([
    getNewProjectsLastWeek(supabase, new Set(highlyRated.map((p) => p.id))),
    getNotableCommentsLastWeek(supabase),
    getNotableGrantsLastWeek(supabase, 15),
  ])

  const { weekStart } = formatWeekRange()
  const subject = `Manifund: Weekly Digest, from ${weekStart}`
  const htmlBody = generateHtmlDigest(projects, notableComments, notableGrants, highlyRated)
  const textBody = generatePlaintextDigest(projects, notableComments, notableGrants, highlyRated)

  console.log(
    `Found ${highlyRated.length} highly rated, ${projects.length} new projects, ${notableComments.length} notable comments, ${notableGrants.length} notable grants`
  )

  const recipients = [
    ...DEFAULT_DIGEST_RECIPIENTS,
    ...(await getLargeDonorsEmails(supabase)),
    ...(await getRegrantorEmails(supabase)),
    ...(await getTopCreatorEmails(supabase)),
  ]
  const uniqueRecipients = new Set(recipients)

  const batchEmails = Array.from(uniqueRecipients)
    // Cap at 500 recipients due to Postmark limit
    .slice(0, 500)
    .map((email) => ({
      toEmail: email,
      subject,
      htmlBody,
      textBody,
      fromEmail: 'Manifund Digest <digest@manifund.org>',
      messageStream: 'broadcast' as const,
    }))

  try {
    await sendBatchEmail(batchEmails)
    console.log(`Weekly digest sent to ${recipients.length} recipients via batch API`)
  } catch (error) {
    console.error('Failed to send weekly digest batch:', error)
  }
}
