import fs from 'fs'
import path from 'path'
import { createAdminClient } from '@/db/edge'
import { createProjectScoringText } from '@/app/utils/project-scores'

export const CUTOFF = '2026-07-01'
export const RESULTS_DIR = path.join(import.meta.dir, 'results')

export type EvalProject = {
  id: string
  slug: string
  title: string
  blurb: string | null
  description: any
  created_at: string
  stage: string
  min_funding: number
  funding_goal: number
  quality_score: number | null
  karma: number
  creator_name: string
  creator_username: string
  causes: string[]
}

export type EvalRow = {
  run_id: string
  mode: 'text' | 'web'
  prompt_version: string
  model_requested: string
  model_served: string | null
  effort: string
  project_id: string
  slug: string
  title: string
  base_rate: number
  output: {
    opinion: string
    score: number
    p_min_funding: number
    outcome_leaked: boolean
    team_findings?: string
  } | null
  error: string | null
  web_queries: string[]
  web_urls: string[]
  usage: Record<string, number>
  cost_usd: number
  raw_text: string
  scored_at: string
}

// Public, non-dummy projects created on or after CUTOFF. Stage and funding
// fields are returned for outcome labels only; never put them in a prompt.
export async function loadProjects(opts: { withFunding?: boolean } = {}): Promise<EvalProject[]> {
  const supabase = createAdminClient()
  const funding = opts.withFunding
    ? ', type, creator, bids(amount, status, type), txns(amount, token, to_id)'
    : ''
  const { data } = await supabase
    .from('projects')
    .select(
      `id, slug, title, blurb, description, created_at, stage, min_funding, funding_goal, quality_score, karma, profiles!projects_creator_fkey(full_name, username), project_causes(cause_slug)${funding}`
    )
    .gte('created_at', CUTOFF)
    .not('stage', 'in', '("hidden","draft")')
    .neq('type', 'dummy')
    .order('created_at')
    .throwOnError()
  return (data ?? []).map(({ profiles, project_causes, ...p }: any) => ({
    ...p,
    causes: (project_causes ?? []).map((c: any) => c.cause_slug),
    creator_name: profiles?.full_name ?? '',
    creator_username: profiles?.username ?? '',
  }))
}

// grantmaking.ai funds through Manifund, so a proposal that mentions it (usually a
// cross-post link) nearly always reaches its minimum. Treated as an outcome leak.
export const mentionsGrantmakingAi = (p: EvalProject) =>
  /grantmaking[ .]?ai/i.test(createProjectScoringText(p))

export type ScreenRow = {
  project_id: string
  slug: string
  prearranged: boolean
  evidence: string
  model: string
  cost_usd: number
}

export function readScreen() {
  const m = new Map<string, ScreenRow>()
  const file = path.join(RESULTS_DIR, 'screen.jsonl')
  if (!fs.existsSync(file)) return m
  for (const l of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const r: ScreenRow = JSON.parse(l)
    m.set(r.project_id, r)
  }
  return m
}

// Text shows this project's funding was arranged elsewhere, so its outcome isn't a forecast.
// Cause tags like leo-microgrants aren't used: the model never sees them.
export const isPrearranged = (p: EvalProject, screen: Map<string, ScreenRow>) =>
  mentionsGrantmakingAi(p) || !!screen.get(p.id)?.prearranged

export const reachedMin = (stage: string) =>
  stage === 'proposal' ? null : stage === 'active' || stage === 'complete'

export function baseRate(projects: EvalProject[]) {
  const closed = projects.map((p) => reachedMin(p.stage)).filter((r) => r !== null)
  return closed.filter(Boolean).length / closed.length
}

// Same input in both modes so the web run differs only by tool access.
export function projectPrompt(p: EvalProject) {
  const lines = [
    `Posted: ${p.created_at.slice(0, 10)}`,
    `Creator: ${p.creator_name} (username: ${p.creator_username})`,
    `Minimum funding: $${p.min_funding.toLocaleString()}`,
    `Funding goal: $${p.funding_goal.toLocaleString()}`,
  ]
  return `${lines.join('\n')}\n\n---\n\n${createProjectScoringText(p)}`
}

export function readRows(runId: string): EvalRow[] {
  const file = path.join(RESULTS_DIR, `${runId}.jsonl`)
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

export function listRuns() {
  if (!fs.existsSync(RESULTS_DIR)) return []
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => f.replace(/\.jsonl$/, ''))
}
