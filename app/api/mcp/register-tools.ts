import 'server-only'

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/db/supabase-admin'
import { filterVisibleProjectTxns } from './filter-visible-project-txns'
import { generateEmbedding, hasEmbeddingKey } from '@/app/utils/embeddings'
import { toMarkdown } from '@/utils/tiptap-parsing'
import { calculateUserBalance, getAmountRaised } from '@/utils/math'
import { pointScore, countVotes } from '@/utils/sort'

const SITE_URL = 'https://manifund.org'

// Top-level guidance sent to MCP clients alongside the tool list
export const SERVER_INSTRUCTIONS = `Manifund (https://manifund.org) hosts fundraising projects in AI safety, existential risk, EA, forecasting, global health, and adjacent causes. Proposal-stage projects are open for funding and are where marginal donations matter most; active projects can also receive donations. When evaluating projects for a user, prefer get_project over search blurbs alone, and weight score, votes, comments, and money raised as quality signals. Use recommend_projects for donor recommendations. Project URLs are shareable; donations happen on manifund.org.`

// Untyped client: the aliased nested select strings below (e.g.
// from:profiles!txns_from_id_fkey(...)) blow up supabase-js type inference
// badly enough to OOM the TypeScript checker.
function adminDb(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

// Cert/AMM trading txn types: excluded from default txn listings since impact
// cert mechanics are confusing out of context. Pass include_cert_txns to see them.
const CERT_TXN_TYPES = [
  'user to user trade',
  'user to amm trade',
  'inject amm liquidity',
  'mint cert',
]
// PostgREST `in` filter literal, quoted because the type names contain spaces
const CERT_TXN_FILTER = `(${CERT_TXN_TYPES.map((t) => `"${t}"`).join(',')})`

type ToolResult = {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

type ToolConfig = {
  title: string
  description: string
  inputSchema: z.ZodRawShape
}

// Register through an untyped boundary: the MCP SDK's registerTool generics
// recurse catastrophically over zod schemas (TS2589 / OOM in `next build`).
// Zod still validates tool inputs at runtime.
function addTool(
  server: McpServer,
  name: string,
  config: ToolConfig,
  handler: (args: any) => Promise<ToolResult>
) {
  ;(server as any).registerTool(name, config, handler)
}

function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

async function run(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn()
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e))
  }
}

// Strip characters that break PostgREST .or()/.ilike filter syntax
function sanitizeSearchTerm(query: string) {
  return query.replace(/[%_,()]/g, ' ').trim()
}

function projectUrl(slug: string) {
  return `${SITE_URL}/projects/${slug}`
}

function profileUrl(username: string) {
  return `${SITE_URL}/${username}`
}

// Every USD txn involving a profile, paginated past PostgREST's 1000-row cap.
// Feed the result to calculateUserBalance — the same calc as profile pages.
async function fetchUsdTxns(db: SupabaseClient, profileId: string) {
  const PAGE = 1000
  const txns: any[] = []
  for (let start = 0; ; start += PAGE) {
    const { data } = await db
      .from('txns')
      .select('amount, token, from_id, to_id')
      .or(`from_id.eq.${profileId},to_id.eq.${profileId}`)
      .eq('token', 'USD')
      .range(start, start + PAGE - 1)
      .throwOnError()
    txns.push(...(data ?? []))
    if (!data || data.length < PAGE) return txns
  }
}

// Everything needed to render a summary AND compute pointScore/getAmountRaised
const PROJECT_SUMMARY_SELECT = `
  id, title, slug, blurb, stage, type, creator, funding_goal, min_funding,
  created_at, auction_close,
  profiles!projects_creator_fkey(username, full_name),
  causes(slug, title),
  txns(amount, token, to_id),
  bids(amount, status, type),
  comments(id),
  project_votes(magnitude)
`

function summarizeProject(project: any, extra?: Record<string, unknown>) {
  // getAmountRaised counts pending bids for proposals, so proposal-stage
  // projects show pledged money instead of $0
  const totalRaised = getAmountRaised(project, project.bids, project.txns)
  return {
    title: project.title,
    url: projectUrl(project.slug),
    slug: project.slug,
    blurb: project.blurb,
    stage: project.stage,
    type: project.type,
    funding_goal: project.funding_goal,
    min_funding: project.min_funding,
    total_raised: totalRaised,
    // The site's aggregate quality score (votes, comments, money raised)
    score: pointScore(project),
    votes: countVotes(project),
    comment_count: (project.comments ?? []).length,
    creator: project.profiles,
    causes: project.causes,
    created_at: project.created_at,
    close_date: project.auction_close,
    ...extra,
  }
}

export function registerPublicTools(server: McpServer, options: { admin: boolean }) {
  const { admin } = options

  addTool(
    server,
    'search_projects',
    {
      title: 'Search projects',
      description:
        'Search Manifund projects. If `query` is given, uses semantic (embedding) search, so natural-language descriptions like "AI safety video projects" work well. Otherwise lists recent projects. Defaults to fundable stages (proposal + active); pass `stage` for others.',
      inputSchema: {
        query: z.string().optional().describe('Natural-language search query'),
        cause: z.string().optional().describe('Cause slug to filter by (see list_causes)'),
        stage: z
          .enum(['proposal', 'active', 'complete', 'not funded'])
          .optional()
          .describe('Filter by one stage; omit for proposal + active'),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, cause, stage, limit }) =>
      run(async () => {
        const db = adminDb()

        let matches: { id: string; similarity: number }[] | null = null
        let warning: string | undefined
        if (query) {
          if (!hasEmbeddingKey()) {
            warning = 'Semantic search is not configured on the server.'
          } else {
            try {
              const { embedding } = await generateEmbedding(query)
              const { data } = await (db.rpc as any)('search_projects_by_embedding', {
                query_embedding: embedding,
                match_count: limit * 3,
                include_hidden: admin,
              }).throwOnError()
              matches = data
            } catch (e) {
              warning = `Semantic search failed (${e instanceof Error ? e.message : e}).`
              console.error('Semantic search failed, falling back to text search:', e)
            }
          }
          if (warning) {
            warning +=
              ' Falling back to keyword matching ordered by recency — results may be poor; tell the user search is degraded.'
          }
        }

        let dbQuery = db
          .from('projects')
          .select(
            cause
              ? PROJECT_SUMMARY_SELECT.replace('causes(', 'causes!inner(')
              : PROJECT_SUMMARY_SELECT
          )
          .neq('type', 'dummy')
        if (!admin) {
          dbQuery = dbQuery.neq('stage', 'hidden').neq('stage', 'draft')
        }
        if (matches) {
          dbQuery = dbQuery.in(
            'id',
            matches.map((m) => m.id)
          )
        } else if (query) {
          // Text fallback when embeddings are unavailable: match any word
          const words = sanitizeSearchTerm(query)
            .split(/\s+/)
            .filter((w) => w.length > 2)
          if (words.length > 0) {
            dbQuery = dbQuery.or(
              words.flatMap((w) => [`title.ilike.*${w}*`, `blurb.ilike.*${w}*`]).join(',')
            )
          }
        }
        if (cause) dbQuery = dbQuery.eq('causes.slug', cause)
        if (stage) {
          dbQuery = dbQuery.eq('stage', stage)
        } else {
          dbQuery = dbQuery.in('stage', ['proposal', 'active'])
        }
        if (!matches) dbQuery = dbQuery.order('created_at', { ascending: false })

        const { data } = await dbQuery.limit(matches ? limit * 3 : limit).throwOnError()
        const projects = (data ?? []) as any[]

        if (matches) {
          const order = new Map(matches.map((m, i) => [m.id, i]))
          projects.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
        }
        const results = projects
          .slice(0, limit)
          .map((p) =>
            summarizeProject(p, { similarity: matches?.find((m) => m.id === p.id)?.similarity })
          )
        return jsonResult({
          search_mode: matches ? 'semantic' : query ? 'keyword' : 'recent',
          ...(warning ? { warning } : {}),
          projects: results,
        })
      })
  )

  addTool(
    server,
    'get_project',
    {
      title: 'Get project details',
      description:
        'Get full details for one project by slug: description (markdown), funding, quality signals (score, votes, comments), donations with donor names, recent comments, causes, and similar projects.',
      inputSchema: {
        slug: z
          .string()
          .describe(
            'Project slug, e.g. from search_projects or a manifund.org/projects/<slug> URL'
          ),
      },
    },
    async ({ slug }) =>
      run(async () => {
        const db = adminDb()
        const { data: project } = await db
          .from('projects')
          .select(
            `
            id, title, slug, blurb, description, stage, type, creator,
            funding_goal, min_funding, created_at, auction_close,
            external_link, location_description,
            profiles!projects_creator_fkey(username, full_name),
            causes(slug, title),
            txns(amount, token, type, created_at, to_id, from:profiles!txns_from_id_fkey(username, full_name)),
            bids(amount, status, type),
            project_votes(magnitude),
            comments(id, content, created_at, replying_to, special_type, author:profiles!comments_commenter_fkey(username, full_name))
          `
          )
          .eq('slug', slug)
          .maybeSingle()
          .throwOnError()

        if (!project || (!admin && ['hidden', 'draft'].includes(project.stage))) {
          return errorResult(`No project found with slug "${slug}"`)
        }

        const { data: similar } = await db
          .rpc('find_similar_projects', { project_id: project.id, match_count: 5 })
          .throwOnError()

        const donations = (project.txns ?? [])
          .filter((txn: any) => txn.token === 'USD' && !CERT_TXN_TYPES.includes(txn.type))
          .map((txn: any) => ({
            amount: txn.amount,
            type: txn.type,
            from: txn.from,
            created_at: txn.created_at,
          }))

        const comments = (project.comments ?? []) as any[]
        const recentComments = [...comments]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5)
          .map((c) => ({
            author: c.author,
            created_at: c.created_at,
            is_reply: Boolean(c.replying_to),
            special_type: c.special_type,
            content: toMarkdown(c.content),
          }))

        return jsonResult({
          title: project.title,
          url: projectUrl(project.slug),
          creator: project.profiles,
          stage: project.stage,
          type: project.type,
          blurb: project.blurb,
          description: toMarkdown(project.description),
          funding_goal: project.funding_goal,
          min_funding: project.min_funding,
          total_raised: getAmountRaised(project as any, project.bids as any, project.txns as any),
          score: pointScore(project as any),
          votes: countVotes(project as any),
          external_link: project.external_link,
          location: project.location_description,
          causes: project.causes,
          created_at: project.created_at,
          close_date: project.auction_close,
          donations,
          comment_count: comments.length,
          recent_comments: recentComments,
          similar_projects: (similar ?? []).map((s: any) => ({
            title: s.title,
            url: projectUrl(s.slug),
            similarity: s.similarity,
          })),
        })
      })
  )

  addTool(
    server,
    'get_comments',
    {
      title: 'Get project comments',
      description:
        'Get the comments on a project (newest first), in markdown. Comments hold the evaluative discussion: regrantor reasoning, questions, and creator responses.',
      inputSchema: {
        project_slug: z.string(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ project_slug, limit }) =>
      run(async () => {
        const db = adminDb()
        const { data: project } = await db
          .from('projects')
          .select('id, stage')
          .eq('slug', project_slug)
          .maybeSingle()
          .throwOnError()
        if (!project || (!admin && ['hidden', 'draft'].includes(project.stage))) {
          return errorResult(`No project found with slug "${project_slug}"`)
        }
        const { data: comments } = await db
          .from('comments')
          .select(
            'id, content, created_at, replying_to, special_type, author:profiles!comments_commenter_fkey(username, full_name)'
          )
          .eq('project', project.id)
          .order('created_at', { ascending: false })
          .limit(limit)
          .throwOnError()
        return jsonResult(
          (comments ?? []).map((c: any) => ({
            id: c.id,
            author: c.author,
            created_at: c.created_at,
            replying_to: c.replying_to,
            special_type: c.special_type,
            content: toMarkdown(c.content),
          }))
        )
      })
  )

  addTool(
    server,
    'recommend_projects',
    {
      title: 'Recommend projects to a donor',
      description:
        "Recommend fundable projects (proposal or active stage) matching a donor's interests, ranked by semantic fit, project quality (votes, comments, funding), and closing-soon urgency. Distill `interests` from what you know about the user, then verify finalists with get_project before presenting.",
      inputSchema: {
        interests: z
          .string()
          .describe(
            'Free-text description of the donor\'s interests, e.g. "mechanistic interpretability, forecasting tools, animal welfare"'
          ),
        causes: z
          .array(z.string())
          .optional()
          .describe('Optional cause slugs to hard-filter by (see list_causes)'),
        budget: z
          .number()
          .optional()
          .describe(
            'Approximate donation budget in USD; boosts proposals this budget could push over their minimum funding bar'
          ),
        limit: z.number().int().min(1).max(30).default(10),
      },
    },
    async ({ interests, causes, budget, limit }) =>
      run(async () => {
        const db = adminDb()
        if (!hasEmbeddingKey()) {
          return errorResult(
            'Semantic search is not configured on the server, so recommendations are unavailable. Use search_projects (keyword mode) instead and tell the user recommendations are degraded.'
          )
        }
        const { embedding } = await generateEmbedding(interests)
        const { data: matches } = await (db.rpc as any)('search_projects_by_embedding', {
          query_embedding: embedding,
          match_count: 50,
          include_hidden: false,
        }).throwOnError()
        const simById = new Map<string, number>(
          (matches ?? []).map((m: any) => [m.id, m.similarity])
        )
        if (simById.size === 0) return jsonResult([])

        let dbQuery = db
          .from('projects')
          .select(
            causes?.length
              ? PROJECT_SUMMARY_SELECT.replace('causes(', 'causes!inner(')
              : PROJECT_SUMMARY_SELECT
          )
          .in('id', Array.from(simById.keys()))
          .in('stage', ['proposal', 'active'])
          .neq('type', 'dummy')
        if (causes?.length) dbQuery = dbQuery.in('causes.slug', causes)
        const { data } = await dbQuery.throwOnError()

        const now = Date.now()
        const ranked = ((data ?? []) as any[])
          .map((p) => {
            const summary = summarizeProject(p)
            const similarity = simById.get(p.id) ?? 0
            // Crude v1 ranking: semantic fit dominates, quality and urgency nudge
            const quality = Math.min(Math.max(summary.score, 0), 50) / 50
            const daysToClose = p.auction_close
              ? (new Date(p.auction_close).getTime() - now) / (1000 * 60 * 60 * 24)
              : null
            const closingSoon =
              p.stage === 'proposal' && daysToClose !== null && daysToClose > 0 && daysToClose <= 14
            // Projects whose fundraise closed long ago are technically still
            // donatable but rarely what a donor is looking for
            const stale = daysToClose !== null && daysToClose < -90
            const fundingGap =
              p.stage === 'proposal' ? Math.max(0, p.min_funding - summary.total_raised) : 0
            const budgetCompletes = Boolean(budget && fundingGap > 0 && budget >= fundingGap)
            const rank =
              0.65 * similarity +
              0.25 * quality +
              0.1 * (closingSoon ? 1 : 0) +
              (budgetCompletes ? 0.05 : 0) -
              (stale ? 0.1 : 0)
            return {
              ...summary,
              similarity,
              funding_gap_to_minimum: fundingGap,
              days_until_close: daysToClose === null ? null : Math.round(daysToClose),
              rank_score: rank,
            }
          })
          .sort((a, b) => b.rank_score - a.rank_score)
          .slice(0, limit)
        return jsonResult(ranked)
      })
  )

  addTool(
    server,
    'search_users',
    {
      title: 'Search users',
      description: 'Search Manifund user profiles by username or full name.',
      inputSchema: {
        query: z.string().describe('Name or username to search for'),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, limit }) =>
      run(async () => {
        const db = adminDb()
        const q = sanitizeSearchTerm(query)
        const { data: profiles } = await db
          .from('profiles')
          .select('username, full_name, bio, type, regranter_status, accreditation_status')
          .or(`username.ilike.*${q}*,full_name.ilike.*${q}*`)
          .limit(limit)
          .throwOnError()
        return jsonResult((profiles ?? []).map((p) => ({ ...p, url: profileUrl(p.username) })))
      })
  )

  addTool(
    server,
    'get_user',
    {
      title: 'Get user details',
      description:
        'Get a user profile by username, with their current USD balance, the projects they created, and recent money transactions (donations, deposits, withdrawals).',
      inputSchema: {
        username: z.string(),
      },
    },
    async ({ username }) =>
      run(async () => {
        const db = adminDb()
        const { data: profile } = await db
          .from('profiles')
          .select(
            'id, username, full_name, bio, website, type, regranter_status, accreditation_status'
          )
          .eq('username', username)
          .maybeSingle()
          .throwOnError()
        if (!profile) return errorResult(`No user found with username "${username}"`)

        let projectQuery = db
          .from('projects')
          .select('title, slug, stage, blurb, created_at')
          .eq('creator', profile.id)
          .order('created_at', { ascending: false })
        if (!admin) projectQuery = projectQuery.neq('stage', 'hidden').neq('stage', 'draft')
        const { data: projects } = await projectQuery.throwOnError()

        const txnSelect = `
          amount, token, type, created_at,
          from:profiles!txns_from_id_fkey(username, full_name),
          to:profiles!txns_to_id_fkey(username, full_name),
          project:projects(title, slug, stage)
        `
        const txnQuery = db
          .from('txns')
          .select(txnSelect)
          .or(`from_id.eq.${profile.id},to_id.eq.${profile.id}`)
          .eq('token', 'USD')
          .not('type', 'in', CERT_TXN_FILTER)
          .order('created_at', { ascending: false })
          .limit(100)
        const [{ data: txns }, balanceTxns] = await Promise.all([
          txnQuery.throwOnError(),
          fetchUsdTxns(db, profile.id),
        ])
        const balance = calculateUserBalance(balanceTxns, profile.id)

        return jsonResult({
          ...profile,
          id: admin ? profile.id : undefined,
          url: profileUrl(profile.username),
          balance,
          projects: (projects ?? []).map((p) => ({ ...p, url: projectUrl(p.slug) })),
          recent_txns: filterVisibleProjectTxns(txns, admin),
        })
      })
  )

  addTool(
    server,
    'get_txns',
    {
      title: 'Get transactions',
      description:
        'Query money transactions, filtered by user, project, type, and date range. Includes donations, deposits, and withdrawals; impact cert / AMM trade txns are excluded unless include_cert_txns is set.',
      inputSchema: {
        username: z.string().optional().describe('Only txns sent or received by this user'),
        project_slug: z.string().optional().describe('Only txns for this project'),
        type: z
          .string()
          .optional()
          .describe('Txn type, e.g. "project donation", "deposit", "withdraw"'),
        token: z.string().default('USD').describe('"USD" for money; certs use other tokens'),
        include_cert_txns: z
          .boolean()
          .default(false)
          .describe(`Include cert/AMM trading txns (${CERT_TXN_TYPES.join(', ')})`),
        after: z.string().optional().describe('ISO date, only txns after this'),
        before: z.string().optional().describe('ISO date, only txns before this'),
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    async ({ username, project_slug, type, token, include_cert_txns, after, before, limit }) =>
      run(async () => {
        const db = adminDb()

        let query = db
          .from('txns')
          .select(
            `
            id, amount, token, type, created_at,
            from:profiles!txns_from_id_fkey(username, full_name),
            to:profiles!txns_to_id_fkey(username, full_name),
            project:projects(title, slug, stage)
          `
          )
          .order('created_at', { ascending: false })
          .limit(limit)

        if (token) query = query.eq('token', token)
        if (type) {
          query = query.eq('type', type)
        } else if (!include_cert_txns) {
          query = query.not('type', 'in', CERT_TXN_FILTER)
        }
        if (username) {
          const { data: profile } = await db
            .from('profiles')
            .select('id')
            .eq('username', username)
            .maybeSingle()
            .throwOnError()
          if (!profile) return errorResult(`No user found with username "${username}"`)
          query = query.or(`from_id.eq.${profile.id},to_id.eq.${profile.id}`)
        }
        if (project_slug) {
          const { data: project } = await db
            .from('projects')
            .select('id, stage')
            .eq('slug', project_slug)
            .maybeSingle()
            .throwOnError()
          if (!project || (!admin && ['hidden', 'draft'].includes(project.stage))) {
            return errorResult(`No project found with slug "${project_slug}"`)
          }
          query = query.eq('project', project.id)
        }
        if (after) query = query.gte('created_at', new Date(after).toISOString())
        if (before) query = query.lte('created_at', new Date(before).toISOString())

        const { data: txns } = await query.throwOnError()
        return jsonResult(filterVisibleProjectTxns(txns, admin))
      })
  )

  addTool(
    server,
    'get_user_balances',
    {
      title: 'Get user balances',
      description:
        'Get current USD balances for a set of users, computed from their transaction history (the same balance shown on manifund.org profiles).',
      inputSchema: {
        usernames: z.array(z.string()).min(1).max(50),
      },
    },
    async ({ usernames }: { usernames: string[] }) =>
      run(async () => {
        const db = adminDb()
        const { data: profiles } = await db
          .from('profiles')
          .select('id, username')
          .in('username', usernames)
          .throwOnError()
        const found = profiles ?? []
        const balances = await Promise.all(
          found.map(async (p) => ({
            username: p.username,
            balance: calculateUserBalance(await fetchUsdTxns(db, p.id), p.id),
          }))
        )
        const notFound = usernames.filter((u) => !found.some((p) => p.username === u))
        return jsonResult({ balances, not_found: notFound })
      })
  )

  addTool(
    server,
    'list_causes',
    {
      title: 'List causes',
      description:
        'List all cause areas / funding rounds on Manifund, with their slugs for filtering.',
      inputSchema: {},
    },
    async () =>
      run(async () => {
        const db = adminDb()
        const { data: causes } = await db
          .from('causes')
          .select('slug, title, subtitle, open, prize')
          .order('sort')
          .throwOnError()
        return jsonResult(causes)
      })
  )
}

export function registerAdminTools(server: McpServer) {
  addTool(
    server,
    'query_sql',
    {
      title: 'Run read-only SQL',
      description:
        'Run an arbitrary read-only SQL query (single SELECT statement) against the Manifund Postgres database. Use get_database_schema first to see tables and columns. Results are capped at max_rows.',
      inputSchema: {
        sql: z.string().describe('A single SELECT statement (no trailing semicolon needed)'),
        max_rows: z.number().int().min(1).max(1000).default(200),
      },
    },
    async ({ sql, max_rows }) =>
      run(async () => {
        const cleaned = sql.trim().replace(/;+\s*$/, '')
        if (cleaned.includes(';')) {
          return errorResult('Only a single SQL statement is allowed')
        }
        const db = adminDb()
        const { data } = await (db.rpc as any)('execute_readonly_sql', {
          query: cleaned,
          max_rows,
        }).throwOnError()
        return jsonResult(data)
      })
  )

  addTool(
    server,
    'get_database_schema',
    {
      title: 'Get database schema',
      description:
        'List all tables and columns in the Manifund database, with notes on key semantics.',
      inputSchema: {},
    },
    async () =>
      run(async () => {
        const db = adminDb()
        const { data } = await (db.rpc as any)('execute_readonly_sql', {
          query: `
            select table_name, column_name, data_type
            from information_schema.columns
            where table_schema = 'public'
            order by table_name, ordinal_position
          `,
          max_rows: 1000,
        }).throwOnError()
        return jsonResult({
          notes: [
            'txns: money movements. token = "USD" for dollars; other tokens are impact cert shares. from_id/to_id reference profiles(id); from_id is null for deposits (money entering from outside).',
            `txn types: profile donation, project donation, user to user trade, user to amm trade, withdraw, deposit, cash to charity transfer, inject amm liquidity, mint cert, mana deposit, tip, return bank funds.`,
            'projects.stage: proposal, active, not funded, complete, hidden, draft. projects.creator references profiles(id).',
            'profiles: all users and orgs. The users view maps profile id -> auth email.',
            'bids: pending offers/donations that have not yet become txns.',
            'stripe_txns: Stripe checkout records; txn_id references the resulting deposit txn.',
            'Amounts are in dollars (not cents).',
          ],
          columns: data,
        })
      })
  )

  addTool(
    server,
    'lookup_users',
    {
      title: 'Look up users by email or username',
      description:
        'Match users by email address, username, or full name — returns id, username, full name, and email. Useful for reconciling external records (e.g. spreadsheets of named donors) against Manifund accounts.',
      inputSchema: {
        emails: z.array(z.string()).optional(),
        usernames: z.array(z.string()).optional(),
        full_names: z.array(z.string()).optional(),
      },
    },
    async ({
      emails,
      usernames,
      full_names,
    }: {
      emails?: string[]
      usernames?: string[]
      full_names?: string[]
    }) =>
      run(async () => {
        if (!emails?.length && !usernames?.length && !full_names?.length) {
          return errorResult('Provide at least one of emails, usernames, or full_names')
        }
        const db = adminDb()
        const ids = new Set<string>()

        if (emails?.length) {
          const { data } = await db.from('users').select('id').in('email', emails).throwOnError()
          data?.forEach((u) => u.id && ids.add(u.id))
        }
        if (usernames?.length || full_names?.length) {
          const filters = [
            ...(usernames ?? []).map((u) => `username.ilike.${sanitizeSearchTerm(u)}`),
            ...(full_names ?? []).map((n) => `full_name.ilike.*${sanitizeSearchTerm(n)}*`),
          ]
          const { data } = await db
            .from('profiles')
            .select('id')
            .or(filters.join(','))
            .throwOnError()
          data?.forEach((p) => ids.add(p.id))
        }
        if (ids.size === 0) return jsonResult([])

        const idList = Array.from(ids)
        const [{ data: profiles }, { data: users }] = await Promise.all([
          db
            .from('profiles')
            .select('id, username, full_name, type')
            .in('id', idList)
            .throwOnError(),
          db.from('users').select('id, email').in('id', idList).throwOnError(),
        ])
        const emailById = new Map((users ?? []).map((u) => [u.id, u.email]))
        return jsonResult(
          (profiles ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? null }))
        )
      })
  )

  addTool(
    server,
    'get_stripe_txns',
    {
      title: 'Get Stripe transactions',
      description:
        'Get Stripe checkout (deposit) records, with the depositor email, for reconciling against Stripe payouts.',
      inputSchema: {
        after: z.string().optional().describe('ISO date'),
        before: z.string().optional().describe('ISO date'),
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    async ({ after, before, limit }) =>
      run(async () => {
        const db = adminDb()
        let query = db
          .from('stripe_txns')
          .select('id, created_at, amount, session_id, customer_id, txn_id')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (after) query = query.gte('created_at', new Date(after).toISOString())
        if (before) query = query.lte('created_at', new Date(before).toISOString())
        const { data: stripeTxns } = await query.throwOnError()

        const customerIds = Array.from(new Set((stripeTxns ?? []).map((t) => t.customer_id)))
        const { data: users } = await db
          .from('users')
          .select('id, email')
          .in('id', customerIds)
          .throwOnError()
        const emailById = new Map((users ?? []).map((u) => [u.id, u.email]))

        return jsonResult(
          (stripeTxns ?? []).map((t) => ({
            ...t,
            customer_email: emailById.get(t.customer_id) ?? null,
          }))
        )
      })
  )
}
