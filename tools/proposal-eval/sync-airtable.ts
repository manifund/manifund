// Upserts projects (with current outcomes) and eval rows into the
// "Manifund AI Evals" Airtable base. Safe to rerun.
// bun tools/proposal-eval/sync-airtable.ts [--run <run_id> ...]   (default: all runs)
// Needs AIRTABLE_PAT in .env.local (scopes: data.records:read/write on the base).
import { parseArgs } from 'util'
import { getAmountRaised } from '@/utils/math'
import {
  EvalRow,
  isPrearranged,
  listRuns,
  loadProjects,
  mentionsGrantmakingAi,
  reachedMin,
  readRows,
  readScreen,
} from './lib'

const BASE_ID = 'appvalF5dSKjOUahH'
const PROJECTS_TABLE = 'tblDbs6LiDlY55WQh'
const EVALS_TABLE = 'tblQqdfTHTLbrd6O1'

const { values: args } = parseArgs({ options: { run: { type: 'string', multiple: true } } })
const PAT = process.env.AIRTABLE_PAT
if (!PAT) throw new Error('Missing AIRTABLE_PAT')

async function airtable(method: string, path: string, body?: unknown) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 30_000))
      continue
    }
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`)
    return res.json()
  }
}

// Airtable caps upserts at 10 records/request and 5 requests/sec per base.
async function upsert(table: string, mergeOn: string, records: Record<string, unknown>[]) {
  const ids = new Map<string, string>()
  for (let i = 0; i < records.length; i += 10) {
    const res = await airtable('PATCH', table, {
      performUpsert: { fieldsToMergeOn: [mergeOn] },
      typecast: true,
      records: records.slice(i, i + 10).map((fields) => ({ fields })),
    })
    for (const r of res.records) ids.set(r.fields[mergeOn], r.id)
    await new Promise((r) => setTimeout(r, 220))
  }
  return ids
}

// Latest successful row per project wins (errored attempts are retried in the same file).
function latestRows(runId: string) {
  const byProject = new Map<string, EvalRow>()
  for (const r of readRows(runId)) if (r.output) byProject.set(r.project_id, r)
  return [...byProject.values()]
}

async function main() {
  const projects = await loadProjects({ withFunding: true })
  const screen = readScreen()
  const projectIds = await upsert(
    PROJECTS_TABLE,
    'Project ID',
    projects.map((p: any) => {
      const reached = reachedMin(p.stage)
      return {
        Title: p.title,
        'Project ID': p.id,
        URL: `https://manifund.org/projects/${p.slug}`,
        Creator: p.creator_name || p.creator_username,
        Created: p.created_at.slice(0, 10),
        'Min funding': p.min_funding,
        Goal: p.funding_goal,
        Stage: p.stage,
        Outcome: reached === null ? 'open' : reached ? 'reached min' : 'not funded',
        Raised: getAmountRaised(p, p.bids, p.txns),
        'Quality score': p.quality_score,
        Karma: p.karma,
        Prearranged: isPrearranged(p, screen),
        'Prearranged evidence': mentionsGrantmakingAi(p)
          ? 'mentions grantmaking.ai'
          : screen.get(p.id)?.prearranged
            ? screen.get(p.id)!.evidence
            : '',
      }
    })
  )
  console.log(`Synced ${projectIds.size} projects`)

  for (const runId of args.run ?? listRuns()) {
    const rows = latestRows(runId)
    const ids = await upsert(
      EVALS_TABLE,
      'Eval key',
      rows.map((r) => ({
        'Eval key': `${r.run_id}:${r.project_id}`,
        Project: projectIds.has(r.project_id) ? [projectIds.get(r.project_id)] : [],
        Run: r.run_id,
        Mode: r.mode,
        Model: r.model_served ?? r.model_requested,
        'Prompt version': r.prompt_version,
        Effort: r.effort,
        Score: r.output!.score,
        'P(min funding)': r.output!.p_min_funding,
        Opinion: r.output!.opinion,
        'Team findings': r.output!.team_findings ?? '',
        'Outcome leaked': r.output!.outcome_leaked,
        'Web queries': r.web_queries.join('\n'),
        'Web URLs': r.web_urls.join('\n'),
        Cost: r.cost_usd,
        'Scored at': r.scored_at,
      }))
    )
    console.log(`Synced ${ids.size} evals from run ${runId}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
