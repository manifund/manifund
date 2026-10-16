// Scores Manifund proposals with Claude. Resumable: projects already in the
// run's JSONL are skipped (errored rows are retried).
// bun tools/proposal-eval/run.ts --mode text|web --run-id <id> [--prompt v2] [--provider openrouter|anthropic]
//   [--skip-prearranged] [--limit N] [--project <slug>] [--concurrency 8] [--effort high] [--dry-run]
import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import {
  EvalProject,
  EvalRow,
  RESULTS_DIR,
  baseRate,
  isPrearranged,
  loadProjects,
  projectPrompt,
  reachedMin,
  readRows,
  readScreen,
} from './lib'
// $/MTok; web search is $10 per 1k searches.
const PRICES: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
}
const SEARCH_PRICE = 0.01
// manifund.com serves the same site as manifund.org.
const BLOCKED_DOMAINS = ['manifund.org', 'manifund.com', 'manifund.substack.com']

const { values: args } = parseArgs({
  options: {
    mode: { type: 'string' },
    'run-id': { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    limit: { type: 'string' },
    project: { type: 'string', multiple: true },
    concurrency: { type: 'string', default: '8' },
    effort: { type: 'string', default: 'high' },
    'dry-run': { type: 'boolean', default: false },
    // Rescore these slugs even if already scored; the new row supersedes the old.
    redo: { type: 'string', multiple: true },
    prompt: { type: 'string', default: 'v2' },
    // Web mode needs Anthropic's server tools (blocked_domains), so it requires --provider anthropic.
    provider: { type: 'string', default: 'openrouter' },
    // Skip projects whose text shows funding was arranged elsewhere (screen.ts, grantmaking.ai).
    'skip-prearranged': { type: 'boolean', default: false },
    // Only projects with a known outcome, for cheap prompt comparisons.
    'closed-only': { type: 'boolean', default: false },
  },
})
const PROMPT_VERSION = args.prompt!
const provider = args.provider as 'openrouter' | 'anthropic'
const mode = args.mode as 'text' | 'web'
if (mode !== 'text' && mode !== 'web') throw new Error('--mode must be text or web')
if (provider !== 'openrouter' && provider !== 'anthropic') {
  throw new Error('--provider must be openrouter or anthropic')
}
if (mode === 'web' && provider !== 'anthropic')
  throw new Error('web mode needs --provider anthropic')
const runId = args['run-id']
if (!runId) throw new Error('--run-id is required')
const effort = args.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max'
const MODEL = args.model!
// A full OpenRouter id (e.g. openai/gpt-5.6-sol) is billed from OpenRouter's reported cost.
const PRICE = PRICES[MODEL] ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
if (!PRICES[MODEL] && !(provider === 'openrouter' && MODEL.includes('/'))) {
  throw new Error(`No pricing for ${MODEL}; add it to PRICES`)
}

const outputSchema = {
  type: 'object',
  properties: {
    ...(mode === 'web' ? { team_findings: { type: 'string' } } : {}),
    opinion: { type: 'string' },
    score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    p_min_funding: { type: 'number' },
    outcome_leaked: { type: 'boolean' },
  },
  required: [
    ...(mode === 'web' ? ['team_findings'] : []),
    'opinion',
    'score',
    'p_min_funding',
    'outcome_leaked',
  ],
  additionalProperties: false,
}

const tools =
  mode === 'web'
    ? [
        {
          type: 'web_search_20260209' as const,
          name: 'web_search' as const,
          max_uses: 8,
          blocked_domains: BLOCKED_DOMAINS,
        },
        {
          type: 'web_fetch_20260209' as const,
          name: 'web_fetch' as const,
          max_uses: 5,
          blocked_domains: BLOCKED_DOMAINS,
        },
      ]
    : undefined

const client = provider === 'anthropic' ? new Anthropic() : null
const openrouter =
  provider === 'openrouter'
    ? new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        // New OpenRouter accounts are capped at 20 requests/min per model; the SDK backs off on 429.
        maxRetries: 10,
      })
    : null
// claude-opus-5-5 -> anthropic/claude-opus-5.5
const OPENROUTER_MODEL = MODEL.includes('/')
  ? MODEL
  : `anthropic/${MODEL.replace(/-(\d+)-(\d+)$/, '-$1.$2')}`

function parseOutput(rawText: string) {
  const output = JSON.parse(rawText) as NonNullable<EvalRow['output']>
  if (!(output.p_min_funding >= 0 && output.p_min_funding <= 1)) {
    throw new Error(`p_min_funding out of range: ${output.p_min_funding}`)
  }
  return output
}

async function scoreOpenRouter(p: EvalProject, system: string, rate: number): Promise<EvalRow> {
  const usage: Record<string, number> = {}
  let output: EvalRow['output'] = null
  let error: string | null = null
  let rawText = ''
  let served: string | null = null
  let cost = 0
  try {
    const res = await openrouter!.chat.completions.create({
      model: OPENROUTER_MODEL,
      max_tokens: 32000,
      reasoning_effort: effort as any,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: projectPrompt(p) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'eval', strict: true, schema: outputSchema },
      },
    })
    served = res.model
    usage.input_tokens = res.usage?.prompt_tokens ?? 0
    usage.output_tokens = res.usage?.completion_tokens ?? 0
    usage.reasoning_tokens = res.usage?.completion_tokens_details?.reasoning_tokens ?? 0
    const u = usage
    // OpenRouter reports the billed cost; fall back to list prices.
    cost =
      (res.usage as any)?.cost ??
      (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output) / 1e6
    const choice = res.choices[0]
    rawText = choice?.message?.content ?? ''
    if (choice?.finish_reason === 'length') error = 'max_tokens'
    else if (!rawText) error = `empty response (finish_reason ${choice?.finish_reason})`
    else output = parseOutput(rawText)
  } catch (e: any) {
    output = null
    error = `${e?.status ?? ''} ${e?.message ?? e}`.trim()
  }
  return {
    run_id: runId!,
    mode,
    prompt_version: PROMPT_VERSION,
    model_requested: OPENROUTER_MODEL,
    model_served: served,
    effort,
    project_id: p.id,
    slug: p.slug,
    title: p.title,
    base_rate: rate,
    output,
    error,
    web_queries: [],
    web_urls: [],
    usage,
    cost_usd: Math.round(cost * 10000) / 10000,
    raw_text: rawText,
    scored_at: new Date().toISOString(),
  }
}

async function scoreOne(p: EvalProject, system: string, rate: number): Promise<EvalRow> {
  if (provider === 'openrouter') return scoreOpenRouter(p, system, rate)
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: projectPrompt(p) }]
  const usage: Record<string, number> = {}
  const add = (k: string, v: number | null | undefined) => (usage[k] = (usage[k] ?? 0) + (v ?? 0))
  const webQueries: string[] = []
  const webUrls: string[] = []
  let final: Anthropic.Beta.BetaMessage | null = null
  let error: string | null = null

  try {
    // Server tool loops can stop with pause_turn; resend to let the server resume.
    for (let i = 0; i < 5; i++) {
      final = await client!.beta.messages
        .stream({
          model: MODEL,
          max_tokens: 32000,
          ...(MODEL === 'claude-opus-5-5'
            ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
          thinking: { type: 'adaptive' },
          output_config: { effort, format: { type: 'json_schema', schema: outputSchema } },
          system,
          tools,
          messages,
        })
        .finalMessage()
      add('input_tokens', final.usage.input_tokens)
      add('output_tokens', final.usage.output_tokens)
      add('cache_creation_input_tokens', final.usage.cache_creation_input_tokens)
      add('cache_read_input_tokens', final.usage.cache_read_input_tokens)
      add('web_search_requests', final.usage.server_tool_use?.web_search_requests)
      add('web_fetch_requests', final.usage.server_tool_use?.web_fetch_requests)
      for (const block of final.content as any[]) {
        if (block.type === 'server_tool_use') {
          webQueries.push(block.input?.query ?? block.input?.url ?? JSON.stringify(block.input))
        } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          webUrls.push(...block.content.map((r: any) => r.url))
        } else if (block.type === 'web_fetch_tool_result' && block.content?.url) {
          webUrls.push(block.content.url)
        }
      }
      if (final.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: final.content as any })
    }
  } catch (e: any) {
    error = `${e?.status ?? ''} ${e?.message ?? e}`.trim()
  }

  // Final JSON is the text after the last tool result.
  const blocks = (final?.content ?? []) as any[]
  const lastTool = blocks.findLastIndex((b) => b.type !== 'text' && b.type !== 'thinking')
  const rawText = blocks
    .slice(lastTool + 1)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  let output: EvalRow['output'] = null
  if (!error) {
    if (final?.stop_reason === 'refusal') error = `refusal: ${JSON.stringify(final.stop_details)}`
    else if (final?.stop_reason === 'max_tokens') error = 'max_tokens'
    else {
      try {
        output = parseOutput(rawText)
      } catch (e: any) {
        output = null
        error = `parse: ${e.message}`
      }
    }
  }

  const cost =
    ((usage.input_tokens ?? 0) * PRICE.input +
      (usage.output_tokens ?? 0) * PRICE.output +
      (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead) /
      1e6 +
    (usage.web_search_requests ?? 0) * SEARCH_PRICE

  return {
    run_id: runId!,
    mode,
    prompt_version: PROMPT_VERSION,
    model_requested: MODEL,
    model_served: final?.model ?? null,
    effort,
    project_id: p.id,
    slug: p.slug,
    title: p.title,
    base_rate: rate,
    output,
    error,
    web_queries: [...new Set(webQueries)],
    web_urls: [...new Set(webUrls)],
    usage,
    cost_usd: Math.round(cost * 10000) / 10000,
    raw_text: rawText,
    scored_at: new Date().toISOString(),
  }
}

async function main() {
  let all = await loadProjects()
  if (args['skip-prearranged']) {
    const screen = readScreen()
    if (!screen.size) throw new Error('No results/screen.jsonl; run screen.ts first')
    const before = all.length
    all = all.filter((p) => !isPrearranged(p, screen))
    console.log(`Skipping ${before - all.length} prearranged projects`)
  }
  if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY')
  }
  // Base rate is over the population being judged, so it excludes skipped projects.
  const rate = baseRate(all)
  if (args['closed-only']) all = all.filter((p) => reachedMin(p.stage) !== null)
  const ratePct = `${Math.round(rate * 100)}%`
  const system = fs
    .readFileSync(path.join(import.meta.dir, 'prompts', `${PROMPT_VERSION}-${mode}.md`), 'utf8')
    .replaceAll('{{BASE_RATE}}', ratePct)

  const done = new Set(
    readRows(runId!)
      .filter((r) => r.output)
      .map((r) => r.project_id)
  )
  let todo = all.filter((p) => !done.has(p.id))
  if (args.redo) todo = all.filter((p) => args.redo!.includes(p.slug))
  if (args.project) todo = todo.filter((p) => args.project!.includes(p.slug))
  if (args.limit) todo = todo.slice(0, Number(args.limit))
  console.log(
    `${all.length} projects, base rate ${ratePct}, ${done.size} already scored, ${todo.length} to score (mode=${mode}, effort=${effort})`
  )

  if (args['dry-run']) {
    console.log(
      `\n=== SYSTEM ===\n${system}\n=== USER (${todo[0]?.slug}) ===\n${todo[0] && projectPrompt(todo[0])}`
    )
    return
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const out = path.join(RESULTS_DIR, `${runId}.jsonl`)
  let next = 0
  let totalCost = 0
  let finished = 0
  const worker = async () => {
    while (next < todo.length) {
      const p = todo[next++]
      const row = await scoreOne(p, system, rate)
      fs.appendFileSync(out, JSON.stringify(row) + '\n')
      totalCost += row.cost_usd
      finished++
      const summary = row.output
        ? `score=${row.output.score} p=${row.output.p_min_funding}`
        : `ERROR ${row.error}`
      console.log(
        `[${finished}/${todo.length}] $${totalCost.toFixed(2)} ${p.slug}: ${summary}${row.web_queries.length ? ` (${row.web_queries.length} web calls)` : ''}`
      )
    }
  }
  await Promise.all(Array.from({ length: Number(args.concurrency) }, worker))
  console.log(`Done. Total cost ~$${totalCost.toFixed(2)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
