// Writes results/baseline-data.jsonl: one row per scored, non-prearranged proposal with the outcome,
// the v3a outputs, and non-LLM features known at posting time. Input to baseline.py.
// bun tools/proposal-eval/baseline-export.ts [--run v3a-text]
import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import { createAdminClient } from '@/db/edge'
import { createProjectScoringText } from '@/app/utils/project-scores'
import {
  EvalRow,
  isPrearranged,
  loadProjects,
  reachedMin,
  readRows,
  readScreen,
  RESULTS_DIR,
} from './lib'

const { values: args } = parseArgs({ options: { run: { type: 'string', default: 'v3a-text' } } })
const rows = new Map<string, EvalRow>()
for (const r of readRows(args.run!)) if (r.output) rows.set(r.project_id, r)

const supabase = createAdminClient()
const screen = readScreen()
const projects = (await loadProjects()).filter((p) => !isPrearranged(p, screen))
const { data: meta } = await supabase
  .from('projects')
  .select('id, creator, project_causes(cause_slug)')
  .in(
    'id',
    projects.map((p) => p.id)
  )
  .throwOnError()
const metaById = new Map(meta!.map((m: any) => [m.id, m]))
const creators = [...new Set(meta!.map((m: any) => m.creator))]

const { data: profiles } = await supabase
  .from('profiles')
  .select('id, created_at, regranter_status')
  .in('id', creators)
  .throwOnError()
const profileById = new Map(profiles!.map((p) => [p.id, p]))
const { data: allProjects } = await supabase
  .from('projects')
  .select('creator, created_at, stage')
  .in('creator', creators)
  .not('stage', 'in', '("hidden","draft")')
  .throwOnError()
// Donations the creator made, as a sign of prior involvement in the community.
const { data: gifts } = await supabase
  .from('txns')
  .select('from_id, created_at')
  .in('from_id', creators)
  .eq('token', 'USD')
  .in('type', ['project donation', 'user to user trade'])
  .throwOnError()

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5
const out = projects.flatMap((p) => {
  const r = rows.get(p.id)
  const m: any = metaById.get(p.id)
  if (!r || r.output!.outcome_leaked || !m) return []
  const prof = profileById.get(m.creator)
  const prior = allProjects!.filter((q) => q.creator === m.creator && q.created_at < p.created_at)
  const text = createProjectScoringText(p)
  return [
    {
      id: p.id,
      slug: p.slug,
      funded: reachedMin(p.stage),
      llm_p: r.output!.p_min_funding,
      llm_score: r.output!.score,
      quality_score: p.quality_score,
      min_funding: p.min_funding,
      funding_goal: p.funding_goal,
      text,
      text_len: text.length,
      days_since_cutoff: days('2026-07-01', p.created_at),
      causes: (m.project_causes ?? []).map((c: any) => c.cause_slug),
      account_age_days: prof ? Math.max(0, days(prof.created_at, p.created_at)) : 0,
      regranter: !!prof?.regranter_status,
      prior_projects: prior.length,
      prior_funded: prior.filter((q) => q.stage === 'active' || q.stage === 'complete').length,
      prior_donations: gifts!.filter((g) => g.from_id === m.creator && g.created_at < p.created_at)
        .length,
    },
  ]
})
const file = path.join(RESULTS_DIR, 'baseline-data.jsonl')
fs.writeFileSync(file, out.map((o) => JSON.stringify(o)).join('\n') + '\n')
console.log(`${out.length} rows (${out.filter((o) => o.funded !== null).length} closed) -> ${file}`)
