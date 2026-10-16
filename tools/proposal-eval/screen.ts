// Flags proposals whose text shows funding was already arranged (a funder committed or
// recommended it, the listing pays out a grant decided elsewhere) or reveals the outcome.
// Writes results/screen.jsonl; run.ts --skip-prearranged and analyze.ts exclude flagged projects.
// bun tools/proposal-eval/screen.ts [--model anthropic/claude-sonnet-5.5] [--concurrency 8] [--redo]
import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import OpenAI from 'openai'
import { RESULTS_DIR, ScreenRow, loadProjects, projectPrompt, readScreen } from './lib'

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: 'anthropic/claude-sonnet-5.5' },
    concurrency: { type: 'string', default: '8' },
    redo: { type: 'boolean', default: false },
  },
})

const SYSTEM = `You are screening Manifund funding proposals before a forecasting experiment. A model will later predict whether each proposal reaches its minimum funding from the text alone, so we must remove proposals whose text gives away that the money is already arranged.

Set "prearranged" to true if the text indicates that money toward THIS project's minimum is already committed, promised, recommended or decided, or reveals the outcome. Examples:
- a funder, fund or regrantor has committed, approved or recommended this project (e.g. "recommended for funding by X", "X has agreed to cover the minimum", "the minimum is already committed")
- the listing exists to pay out a grant decided elsewhere (e.g. a cross-post from another grant round, "this page is for receiving our grant from X")
- the creator is a fund or regrantor posting on behalf of a grantee it intends to fund
- the text reports that the project has been funded, reached its goal, or was approved

Set it to false for: funding received for earlier or other work, applications that are pending or hoped for, general endorsements or advisors, matching offers that depend on other donors, and ordinary asks.

Respond with JSON: {"prearranged": boolean, "evidence": "<short quote from the text, or empty>"}`

const schema = {
  type: 'object',
  properties: { prearranged: { type: 'boolean' }, evidence: { type: 'string' } },
  required: ['prearranged', 'evidence'],
  additionalProperties: false,
}

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  // New OpenRouter accounts are capped at 20 requests/min per model; the SDK backs off on 429.
  maxRetries: 10,
})

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY')
  const projects = await loadProjects()
  const done = args.redo ? new Map() : readScreen()
  const todo = projects.filter((p) => !done.has(p.id))
  console.log(`${projects.length} projects, ${todo.length} to screen with ${args.model}`)
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const out = path.join(RESULTS_DIR, 'screen.jsonl')
  let next = 0
  let flagged = 0
  let cost = 0
  const worker = async () => {
    while (next < todo.length) {
      const p = todo[next++]
      try {
        const res = await client.chat.completions.create({
          model: args.model!,
          max_tokens: 4000,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: projectPrompt(p) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'screen', strict: true, schema },
          },
        })
        const parsed = JSON.parse(res.choices[0]?.message?.content ?? '')
        const row: ScreenRow = {
          project_id: p.id,
          slug: p.slug,
          prearranged: parsed.prearranged,
          evidence: parsed.evidence,
          model: res.model,
          cost_usd: (res.usage as any)?.cost ?? 0,
        }
        fs.appendFileSync(out, JSON.stringify(row) + '\n')
        cost += row.cost_usd
        if (row.prearranged) {
          flagged++
          console.log(`FLAG ${p.slug}: ${row.evidence}`)
        }
      } catch (e: any) {
        console.log(`ERROR ${p.slug}: ${e?.message ?? e}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Number(args.concurrency) }, worker))
  console.log(`Done. ${flagged} flagged, ~$${cost.toFixed(2)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
