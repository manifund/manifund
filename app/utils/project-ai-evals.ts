import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { createProjectScoringText } from '@/app/utils/project-scores'
import { log } from '@/lib/log'
import { sendDiscordMessage } from '@/utils/discord'

// Claude reads each project the way a donor would see it (text, amounts, creator; no votes,
// comments or money raised), gives a 1-5 merit score, a short opinion, and the probability it
// reaches its minimum funding. Prompt v3a was chosen in tools/proposal-eval; on 317 closed
// proposals its probability had AUC 0.86 and averaged 16% against 15% funded.

export const AI_EVAL_PROMPT_VERSION = 'v3a'
export const AI_EVAL_MODEL = 'anthropic/claude-opus-5.5'
// Projects posted earlier may be in the model's training data, outcomes included.
export const AI_EVAL_CUTOFF = '2026-07-01'
// After the first evaluation, edits are re-evaluated only while the project can still take money.
const RESCORE_STAGES = ['proposal', 'active']
// A project's first evaluation at or above this score is posted to Discord.
const TOP_SCORE = 4

const SYSTEM_PROMPT = `You are evaluating a funding proposal posted on Manifund, a platform where individuals and small teams ask for grants, mostly in AI safety, effective altruism, forecasting, and adjacent causes. Donors and regrantors (individuals given a budget to grant) decide whether to fund each proposal. A proposal only receives money if pledges reach its minimum funding amount; otherwise it closes as "not funded".

You will see the proposal text, its minimum and goal amounts, and the creator's name. You will not see votes, comments, or how much it has raised.

Give your honest judgment of the proposal, then predict whether it will reach its minimum funding.

**Minimum size:** on Manifund, proposals with small minimums are not more likely to reach them than proposals with large ones. Don't treat a small ask as easy to cover, or a large one as unlikely, on that basis alone.

**What to weigh:** focus mainly on substance: how capable the people seem, whether the project makes sense and is technically sound, and how valuable it would be if it worked. A detailed budget, milestones and polished sections are useful signals, but they matter less than these. Capable people sometimes get funded on short write-ups, and a thorough, well-formatted proposal can still be weak.

**Score (1-5)** — how good a use of marginal philanthropic money this is, in your judgment:

- 1: Not worth funding (incoherent, off-mission, spam-like, or very likely to fail)
- 2: Weak (doubtful merit, little sign the people can deliver, or low expected impact)
- 3: Reasonable (plausible idea and team, but nothing stands out)
- 4: Strong (sound idea, capable team, clear path to impact)
- 5: Exceptional (a donor would be making an unusually good bet)

The score is your view of merit; the probability is your prediction of what donors on Manifund will actually do. These can diverge: a good proposal can go unfunded, and a mediocre one can be funded.

**Outcome leak:** proposal text is sometimes edited after the fact. If the text itself reveals whether it got funded (e.g. "Update: we reached our goal", "this project was not funded"), set \`outcome_leaked\` to true and still give your best prediction.

Respond with JSON only:

- \`opinion\`: 2-4 sentences of qualitative assessment, naming the main strengths and weaknesses
- \`score\`: integer 1-5
- \`p_min_funding\`: probability (0-1) that it reaches its minimum funding
- \`outcome_leaked\`: boolean`

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    opinion: { type: 'string' },
    score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    p_min_funding: { type: 'number' },
    outcome_leaked: { type: 'boolean' },
  },
  required: ['opinion', 'score', 'p_min_funding', 'outcome_leaked'],
  additionalProperties: false,
}

type EvalProject = {
  id: string
  slug: string
  title: string
  blurb: string | null
  description: any
  created_at: string
  stage: string
  type: string
  min_funding: number
  funding_goal: number
  profiles: { full_name: string | null; username: string | null } | null
}

const PROJECT_FIELDS =
  'id, slug, title, blurb, description, created_at, stage, type, min_funding, funding_goal, profiles!projects_creator_fkey(full_name, username)'

export function hasAiEvalKeys() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

export function aiEvalInput(p: EvalProject) {
  const lines = [
    `Posted: ${p.created_at.slice(0, 10)}`,
    `Creator: ${p.profiles?.full_name ?? ''} (username: ${p.profiles?.username ?? ''})`,
    `Minimum funding: $${p.min_funding.toLocaleString('en-US')}`,
    `Funding goal: $${p.funding_goal.toLocaleString('en-US')}`,
  ]
  return `${lines.join('\n')}\n\n---\n\n${createProjectScoringText(p)}`
}

async function hashText(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function isEligible(p: EvalProject, hash: string, priorHashes: string[]) {
  if (p.stage === 'hidden' || p.stage === 'draft' || p.type === 'dummy') return false
  if (p.created_at < AI_EVAL_CUTOFF) return false
  if (priorHashes.includes(hash)) return false
  return priorHashes.length === 0 || RESCORE_STAGES.includes(p.stage)
}

async function priorEvals(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase
    .from('project_ai_evals')
    .select('content_hash, score')
    .eq('project_id', projectId)
    .eq('prompt_version', AI_EVAL_PROMPT_VERSION)
    .eq('model', AI_EVAL_MODEL)
    .throwOnError()
  return data ?? []
}

async function postTopRated(
  p: EvalProject,
  output: { score: number; p_min_funding: number; opinion: string }
) {
  const name = p.profiles?.full_name || p.profiles?.username || 'someone'
  const usd = (n: number) => `$${n.toLocaleString('en-US')}`
  const message = [
    `**[${p.title}](https://manifund.org/projects/${p.slug})** by ${name}`,
    `Claude: ${output.score}/5 · ${Math.round(output.p_min_funding * 100)}% chance of reaching its minimum · min ${usd(p.min_funding)}, goal ${usd(p.funding_goal)}`,
    `> ${output.opinion}`,
  ].join('\n')
  await sendDiscordMessage(process.env.DISCORD_TOP_PROJECTS_WEBHOOK_URL, message.slice(0, 2000))
}

type CallResult =
  | {
      output: { opinion: string; score: number; p_min_funding: number; outcome_leaked: boolean }
      raw: unknown
      cost: number
    }
  | { declined: string; raw: unknown; cost: number }

async function callModel(input: string): Promise<CallResult> {
  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    // OpenRouter caps us at 20 requests/min per model; the SDK backs off on 429.
    maxRetries: 5,
  })
  const res = await openrouter.chat.completions.create({
    model: AI_EVAL_MODEL,
    max_tokens: 32000,
    reasoning_effort: 'high',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: input },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'eval', strict: true, schema: OUTPUT_SCHEMA },
    },
  })
  const cost = (res.usage as any)?.cost ?? 0
  const choice = res.choices[0]
  const text = choice?.message?.content ?? ''
  const raw = { model: res.model, usage: res.usage, finish_reason: choice?.finish_reason, text }
  // The model refuses some biosecurity proposals; recorded so they aren't retried every night.
  if (choice?.finish_reason === 'content_filter') return { declined: 'content_filter', raw, cost }
  if (choice?.finish_reason === 'length') throw new Error('AI eval hit max_tokens')
  const output = JSON.parse(text)
  if (!(output.p_min_funding >= 0 && output.p_min_funding <= 1)) {
    throw new Error(`AI eval p_min_funding out of range: ${output.p_min_funding}`)
  }
  return { output, raw, cost }
}

// Evaluates one project if it needs it, and records the result. Throws on transient
// failures (network, rate limits, bad JSON) so nothing is recorded and a later run retries.
export async function evaluateProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<'evaluated' | 'declined' | 'skipped'> {
  const { data: project } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('id', projectId)
    .single()
    .throwOnError()
  const p = project as unknown as EvalProject
  const input = aiEvalInput(p)
  const hash = await hashText(input)
  const prior = await priorEvals(supabase, projectId)
  const priorHashes = prior.map((e) => e.content_hash)
  if (!isEligible(p, hash, priorHashes)) return 'skipped'

  const result = await callModel(input)
  const row = {
    project_id: p.id,
    prompt_version: AI_EVAL_PROMPT_VERSION,
    model: AI_EVAL_MODEL,
    content_hash: hash,
    project_stage: p.stage,
    raw: result.raw,
    cost_usd: result.cost,
    ...('output' in result
      ? {
          score: result.output.score,
          p_min_funding: result.output.p_min_funding,
          opinion: result.output.opinion,
          outcome_leaked: result.output.outcome_leaked,
        }
      : { error: result.declined }),
  }
  // A concurrent run may have recorded the same text first; that row stands.
  await supabase
    .from('project_ai_evals')
    .upsert(row as any, {
      onConflict: 'project_id,prompt_version,model,content_hash',
      ignoreDuplicates: true,
    })
    .throwOnError()
  log.info('project.ai_eval', {
    projectId: p.id,
    stage: p.stage,
    score: 'output' in result ? result.output.score : null,
    declined: 'declined' in result,
    costUsd: result.cost,
  })
  if (
    'output' in result &&
    result.output.score >= TOP_SCORE &&
    !prior.some((e) => (e.score ?? 0) >= TOP_SCORE)
  ) {
    await postTopRated(p, result.output)
  }
  return 'output' in result ? 'evaluated' : 'declined'
}

// Nightly catch-up for projects the create/edit hook missed.
export async function syncProjectAiEvals(
  supabase: SupabaseClient,
  options: { limit?: number; concurrency?: number } = {}
) {
  const { limit = 15, concurrency = 5 } = options
  const [{ data: projects }, { data: evals }] = await Promise.all([
    supabase
      .from('projects')
      .select(PROJECT_FIELDS)
      .gte('created_at', AI_EVAL_CUTOFF)
      .not('stage', 'in', '("hidden","draft")')
      .neq('type', 'dummy')
      .order('created_at', { ascending: false })
      .throwOnError(),
    supabase
      .from('project_ai_evals')
      .select('project_id, content_hash')
      .eq('prompt_version', AI_EVAL_PROMPT_VERSION)
      .eq('model', AI_EVAL_MODEL)
      .throwOnError(),
  ])
  const hashesByProject = new Map<string, string[]>()
  for (const e of evals ?? []) {
    hashesByProject.set(e.project_id, [
      ...(hashesByProject.get(e.project_id) ?? []),
      e.content_hash,
    ])
  }

  const todo: string[] = []
  for (const p of (projects ?? []) as unknown as EvalProject[]) {
    const hash = await hashText(aiEvalInput(p))
    if (isEligible(p, hash, hashesByProject.get(p.id) ?? [])) todo.push(p.id)
  }

  const results = { pending: todo.length, evaluated: 0, declined: 0, failed: 0 }
  const batch = todo.slice(0, limit)
  for (let i = 0; i < batch.length; i += concurrency) {
    const settled = await Promise.allSettled(
      batch.slice(i, i + concurrency).map((id) => evaluateProject(supabase, id))
    )
    settled.forEach((s, j) => {
      if (s.status === 'fulfilled') {
        if (s.value === 'evaluated') results.evaluated++
        if (s.value === 'declined') results.declined++
      } else {
        results.failed++
        log.error('project.ai_eval_failed', { projectId: batch[i + j], error: s.reason })
      }
    })
  }
  return results
}
