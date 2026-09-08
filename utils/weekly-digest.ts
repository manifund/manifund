import { SupabaseClient } from '@supabase/supabase-js'
import { FullProject } from '@/db/project'
import { sendEmail, sendBatchEmail } from './email'
import { pointScore, countVotes } from './sort'
import { getAmountRaised } from './math'
import { getUserEmail } from './email'
import { getSponsoredAmount } from './constants'
import { toPlaintext } from './tiptap-parsing'
import { isSlopProject } from './slop'

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
  // to active projects. Both count as notable grants.
  kind: 'bid' | 'donation'
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

const REGRANTOR_BONUS = 2
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

export async function getNewProjectsLastWeek(
  supabase: SupabaseClient,
  limit = 7
): Promise<FullProject[]> {
  const oneWeekAgo = getOneWeekAgo()

  const { data: projectsBase } = await supabase
    .from('projects')
    .select(
      `
      *,
      profiles!projects_creator_fkey(*),
      rounds(title, slug),
      causes(title, slug)
    `
    )
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .gte('created_at', oneWeekAgo.toISOString())
    .order('created_at', { ascending: false })
    .throwOnError()

  if (!projectsBase?.length) return []

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

  const projects: FullProject[] = projectsBase.map((project) => ({
    ...project,
    project_votes: votes.filter((v) => v.project_id === project.id),
    comments: comments.filter((c) => c.project === project.id),
    bids: bids.filter((b) => b.project === project.id),
    txns: txns.filter((t) => t.project === project.id),
    project_transfers: [],
    project_follows: [],
  }))

  return (
    projects
      // Exclude projects with 0 or fewer net upvotes
      .filter((p) => {
        const netUpvotes = p.project_votes.reduce((acc, v) => acc + v.magnitude, 0)
        return netUpvotes > 0
      })
      // Exclude likely-AI-written projects, same as the default projects feed
      .filter((p) => !isSlopProject(p))
      .sort((a, b) => pointScore(b) - pointScore(a))
      .slice(0, limit)
  )
}

export async function getNotableCommentsLastWeek(
  supabase: SupabaseClient,
  limit = 15
): Promise<NotableComment[]> {
  const oneWeekAgo = getOneWeekAgo()

  const [{ data: regrantors }, { data: comments }] = await Promise.all([
    supabase.from('profiles').select('id').eq('regranter_status', true).throwOnError(),
    supabase
      .from('comments')
      .select(
        `
      *,
      profiles!comments_commenter_fkey(id, username, full_name, avatar_url),
      projects(id, title, slug, stage),
      comment_rxns(reactor_id, reaction)
    `
      )
      .gte('created_at', oneWeekAgo.toISOString())
      .neq('projects.stage', 'hidden')
      .order('created_at', { ascending: false })
      .throwOnError(),
  ])

  if (!comments?.length) return []

  const regrantorIds = new Set(regrantors?.map((r) => r.id) || [])

  const commentsWithScores = comments.map((comment) => {
    const reactions = comment.comment_rxns || []
    const reactionCounts: Record<string, number> = {}

    reactions.forEach((rxn: any) => {
      reactionCounts[rxn.reaction] = (reactionCounts[rxn.reaction] || 0) + 1
    })

    const baseScore = Object.values(reactionCounts).reduce(
      (sum, count) => sum + (count as number),
      0
    )
    const isRegrantor = regrantorIds.has(comment.commenter)
    const totalScore = baseScore + (isRegrantor ? REGRANTOR_BONUS : 0)

    return {
      ...comment,
      reactionCounts,
      totalScore,
      isRegrantor,
    }
  })

  return commentsWithScores.sort((a, b) => b.totalScore - a.totalScore).slice(0, limit)
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
      id, amount, bidder, created_at, status,
      profiles!bids_bidder_fkey(id, username, full_name, avatar_url),
      projects(id, title, slug, stage)
    `
      )
      .gte('created_at', oneWeekAgo.toISOString())
      .neq('projects.stage', 'hidden')
      .order('created_at', { ascending: false })
      .throwOnError(),
    // Donations to active projects don't create bids; they land directly in txns
    supabase
      .from('txns')
      .select(
        `
      id, amount, from_id, created_at,
      profiles!txns_from_id_fkey(id, username, full_name, avatar_url),
      projects(id, title, slug, stage)
    `
      )
      .eq('type', 'project donation')
      .eq('token', 'USD')
      .not('project', 'is', null)
      .gte('created_at', oneWeekAgo.toISOString())
      .neq('projects.stage', 'hidden')
      .order('created_at', { ascending: false })
      .throwOnError(),
  ])

  const regrantorIds = new Set(regrantors?.map((r) => r.id) || [])

  const grants: NotableGrant[] = [
    // Accepted bids already produced a matching donation txn, so skip them to
    // avoid listing the same grant twice
    ...(bids ?? [])
      .filter((bid: any) => bid.status !== 'accepted' && bid.status !== 'deleted')
      .map((bid: any) => ({
        id: bid.id,
        amount: bid.amount,
        kind: 'bid' as const,
        createdAt: bid.created_at,
        profiles: bid.profiles ?? undefined,
        projects: bid.projects ?? undefined,
        isRegrantor: regrantorIds.has(bid.bidder),
      })),
    ...(donations ?? [])
      .filter((txn: any) => txn.from_id !== null)
      .map((txn: any) => ({
        id: txn.id,
        amount: txn.amount,
        kind: 'donation' as const,
        createdAt: txn.created_at,
        profiles: txn.profiles ?? undefined,
        projects: txn.projects ?? undefined,
        isRegrantor: regrantorIds.has(txn.from_id),
      })),
  ]

  return grants
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
const generateProjectItem = (project: FullProject): string => {
  const upvotes = project.project_votes.reduce((acc, vote) => acc + vote.magnitude, 0)
  const commentCount = project.comments.length
  const creatorName = getDisplayName(project.profiles)
  const summary = project.blurb
  const raised = getAmountRaised(project, project.bids, project.txns)

  return `
    <div class="item">
      <div class="title"><a href="https://manifund.org/projects/${escapeHtml(
        project.slug
      )}">${escapeHtml(
        project.title
      )}</a> <span class="creator">by ${escapeHtml(creatorName)}</span></div>
      ${summary ? `<div class="summary">${escapeHtml(summary)}</div>` : ''}
      <div class="stats">
        <span>${upvotes} ⬆️</span>
        <span>${commentCount} 💬</span>
        <span>💰 $${raised} / $${project.funding_goal}</span>
      </div>
    </div>
  `
}

const generateCommentItem = (comment: NotableComment): string => {
  const commenterName = getDisplayName(comment.profiles)
  const projectTitle = comment.projects?.title || 'Unknown Project'
  const projectSlug = comment.projects?.slug || ''
  let commentText = toPlaintext(comment.content)

  if (commentText.length > 360) {
    commentText = commentText.substring(0, 360) + '...'
  }

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
      ${reactionHtml ? `<div class="reactions">${reactionHtml}</div>` : ''}
    </div>
  `
}

const generateGrantItem = (grant: NotableGrant): string => {
  const bidderName = getDisplayName(grant.profiles)
  const projectTitle = grant.projects?.title || 'Unknown Project'
  const projectSlug = grant.projects?.slug || ''

  return `
    <div class="item">
      <div class="content">
        <span class="name">${escapeHtml(bidderName)}${
          grant.isRegrantor ? ' ⭐️' : ''
        }</span> ${grant.kind === 'donation' ? 'donated' : 'offered'} <span class="amount">$${grant.amount.toLocaleString()}</span> to 
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
export function generateHtmlDigest(
  projects: FullProject[],
  notableComments: NotableComment[] = [],
  notableGrants: NotableGrant[] = []
): string {
  const { weekStart, weekEnd } = formatWeekRange()

  const projectsSection =
    projects.length > 0
      ? `
      <div class="section">
        ${projects.map(generateProjectItem).join('')}
      </div>
      <div style="text-align: center;">
        <a href="https://manifund.org/projects" class="cta-button">View all projects</a>
      </div>
    `
      : '<div class="no-projects">No new projects were created this week.</div>'

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
  notableGrants: NotableGrant[] = []
): string {
  const { weekStart, weekEnd } = formatWeekRange()

  let text = `Manifund: Weekly Digest\n${weekStart} - ${weekEnd}\n\n`

  if (projects.length === 0) {
    text += 'No new projects were created this week.\n'
  } else {
    text += 'New projects this week:\n\n'
    projects.forEach((project) => {
      const upvotes = project.project_votes.reduce((acc, vote) => acc + vote.magnitude, 0)
      const commentCount = project.comments.length
      const creatorName = getDisplayName(project.profiles)
      const summary = project.blurb ? ` - ${project.blurb}` : ''
      text += `- ${project.title}, by ${creatorName}${summary}. ${upvotes} ⬆️ ${commentCount} 💬\n`
    })
  }

  text += generatePlaintextSection('Notable comments this week', notableComments, (comment) => {
    const commenterName = getDisplayName(comment.profiles)
    const projectTitle = comment.projects?.title || 'Unknown Project'
    const commentText = toPlaintext(comment.content)
    const reactionText = Object.entries(comment.reactionCounts)
      .map(([emoji, count]) => `${emoji}${(count as number) > 1 ? count : ''}`)
      .join(' ')
    return `- ${commenterName}${
      comment.isRegrantor ? ' ⭐️' : ''
    } on "${projectTitle}": ${commentText} ${reactionText}\n`
  })

  text += generatePlaintextSection('Notable grants this week', notableGrants, (grant) => {
    const bidderName = getDisplayName(grant.profiles)
    const projectTitle = grant.projects?.title || 'Unknown Project'
    return `- ${bidderName}${
      grant.isRegrantor ? ' ⭐️' : ''
    } ${grant.kind === 'donation' ? 'donated' : 'offered'} $${grant.amount.toLocaleString()} to ${projectTitle}\n`
  })

  return text
}

// Main function
export async function sendWeeklyDigest(supabase: SupabaseClient): Promise<void> {
  console.log('Starting weekly digest generation...')

  const [projects, notableComments, notableGrants] = await Promise.all([
    getNewProjectsLastWeek(supabase),
    getNotableCommentsLastWeek(supabase, 15),
    getNotableGrantsLastWeek(supabase, 15),
  ])

  const { weekStart } = formatWeekRange()
  const subject = `Manifund: Weekly Digest, from ${weekStart}`
  const htmlBody = generateHtmlDigest(projects, notableComments, notableGrants)
  const textBody = generatePlaintextDigest(projects, notableComments, notableGrants)

  console.log(
    `Found ${projects.length} new projects, ${notableComments.length} notable comments, ${notableGrants.length} notable grants`
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
