// One-off: imports the v3a evaluations already run in tools/proposal-eval into project_ai_evals,
// so they aren't paid for twice. Rows keep their original time; the hash is of the current text.
// bun scripts/backfill-ai-evals.ts tools/proposal-eval/results/v3a-text.jsonl [--dry-run]
import fs from 'fs'
import { createAdminClient } from '@/db/edge'
import {
  AI_EVAL_CUTOFF,
  AI_EVAL_MODEL,
  AI_EVAL_PROMPT_VERSION,
  aiEvalInput,
} from '@/app/utils/project-ai-evals'

const [file, flag] = process.argv.slice(2)
if (!file) throw new Error('Usage: bun scripts/backfill-ai-evals.ts <v3a-text.jsonl> [--dry-run]')
const dryRun = flag === '--dry-run'

const latest = new Map<string, any>()
for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(line)
  if (r.output && r.prompt_version === AI_EVAL_PROMPT_VERSION) latest.set(r.project_id, r)
}

const supabase = createAdminClient()
const { data: projects } = await supabase
  .from('projects')
  .select(
    'id, title, blurb, description, created_at, stage, type, min_funding, funding_goal, profiles!projects_creator_fkey(full_name, username)'
  )
  .gte('created_at', AI_EVAL_CUTOFF)
  .not('stage', 'in', '("hidden","draft")')
  .neq('type', 'dummy')
  .throwOnError()

const hash = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

const rows = []
for (const p of (projects ?? []) as any[]) {
  const r = latest.get(p.id)
  if (!r) continue
  rows.push({
    project_id: p.id,
    prompt_version: AI_EVAL_PROMPT_VERSION,
    model: AI_EVAL_MODEL,
    content_hash: await hash(aiEvalInput(p)),
    project_stage: p.stage,
    score: r.output.score,
    p_min_funding: r.output.p_min_funding,
    opinion: r.output.opinion,
    outcome_leaked: r.output.outcome_leaked,
    raw: { source: 'tools/proposal-eval', run_id: r.run_id, model: r.model_served, usage: r.usage },
    cost_usd: r.cost_usd,
    created_at: r.scored_at,
  })
}
console.log(
  `${latest.size} scored in file, ${rows.length} match public projects since ${AI_EVAL_CUTOFF}`
)

if (!dryRun) {
  for (let i = 0; i < rows.length; i += 100) {
    await supabase
      .from('project_ai_evals')
      .upsert(rows.slice(i, i + 100) as any, {
        onConflict: 'project_id,prompt_version,model,content_hash',
        ignoreDuplicates: true,
      })
      .throwOnError()
  }
  console.log('Imported.')
}
