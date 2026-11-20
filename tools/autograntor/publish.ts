// Saves a finished autograntor run to project_autograntor_evals. The numbers come from re-running the simulator on
// final_ledger.csv, never from text the model typed. Dry run unless --execute.
//
//   bun tools/autograntor/publish.ts <slug> [--models "opus + fable"] [--execute]

import path from 'path'
import { createAdminClient } from '@/db/edge'
import { runDir } from '@/tools/autograntor/lib'
import { parseLedger, resultSummary, simulateLedger } from '@/tools/autograntor/simulate'

const args = process.argv.slice(2)
const slug = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--models')
const execute = args.includes('--execute')
const modelsIdx = args.indexOf('--models')
const models = modelsIdx >= 0 ? args[modelsIdx + 1] : 'claude-code: opus + fable'
if (!slug) {
  console.error('Usage: bun tools/autograntor/publish.ts <slug> [--models "..."] [--execute]')
  process.exit(1)
}

const dir = runDir(slug)
const read = (f: string) => Bun.file(path.join(dir, f)).text()
const [run, reportMd, ledgerCsv] = await Promise.all([
  read('run.json').then(JSON.parse),
  read('report.md'),
  read('final_ledger.csv'),
])

const results = resultSummary(simulateLedger(parseLedger(ledgerCsv)))
const problems: string[] = []
const scored = results.map((r) => r.amount)
for (const a of run.amounts as number[])
  if (!scored.includes(a)) problems.push(`no ledger rows for $${a.toLocaleString('en-US')}`)
for (const r of results) {
  if (![r.mean, r.median, r.p10, r.p90].every(Number.isFinite))
    problems.push(`non-finite numbers at ${r.amount}`)
  if (!(r.p10 <= r.median && r.median <= r.p90))
    problems.push(`quantiles out of order at ${r.amount}`)
}
if (reportMd.trim().length < 200) problems.push('report.md looks empty')
if (problems.length) {
  console.error(`Not publishing: ${problems.join('; ')}`)
  process.exit(1)
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
console.log(`${slug} (${run.prompt_version}, ${run.milestones_version}, ${models})`)
for (const r of results)
  console.log(
    `  $${r.amount.toLocaleString('en-US')}: mean ${fmt(r.mean)}, median ${fmt(r.median)}, p10 ${fmt(r.p10)}, p90 ${fmt(r.p90)}, post-2030 ${Math.round(r.post2030_share * 100)}%`
  )

if (!execute) {
  console.log('\nDry run. Pass --execute to save.')
  process.exit(0)
}

await createAdminClient()
  .from('project_autograntor_evals')
  .insert({
    project_id: run.project_id,
    prompt_version: run.prompt_version,
    milestones_version: run.milestones_version,
    models,
    results,
    report_md: reportMd,
    ledger_csv: ledgerCsv,
    project_content_hash: run.content_hash,
  })
  .throwOnError()
console.log(`\nSaved. https://manifund.org/projects/${slug}/autograntor`)
