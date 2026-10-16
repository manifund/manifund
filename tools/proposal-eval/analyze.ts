// Calibration and correlation report for one or more runs, as markdown.
// bun tools/proposal-eval/analyze.ts [--run <run_id> ...] [--include-leaked]
import { parseArgs } from 'util'
import {
  EvalProject,
  EvalRow,
  isPrearranged,
  listRuns,
  loadProjects,
  reachedMin,
  readRows,
  readScreen,
} from './lib'

const screen = readScreen()

const { values: args } = parseArgs({
  options: {
    run: { type: 'string', multiple: true },
    'include-leaked': { type: 'boolean', default: false },
  },
})

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '-')

function ranks(xs: number[]) {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0])
  const r = new Array(xs.length)
  for (let i = 0; i < order.length; ) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r as number[]
}

function spearman(xs: number[], ys: number[]) {
  const rx = ranks(xs)
  const ry = ranks(ys)
  const mx = mean(rx)
  const my = mean(ry)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy)
}

// AUC = P(random positive scored above random negative), ties count half.
function auc(scores: number[], labels: boolean[]) {
  const r = ranks(scores)
  const nPos = labels.filter(Boolean).length
  const nNeg = labels.length - nPos
  const sumPos = r.filter((_, i) => labels[i]).reduce((a, b) => a + b, 0)
  return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg)
}

function latestRows(runId: string) {
  const byProject = new Map<string, EvalRow>()
  for (const r of readRows(runId)) if (r.output) byProject.set(r.project_id, r)
  return [...byProject.values()]
}

function report(runId: string, projects: Map<string, EvalProject>) {
  const all = latestRows(runId)
  const leaked = all.filter((r) => r.output!.outcome_leaked)
  const manifundMentions = all.filter((r) =>
    [...r.web_queries, ...r.web_urls, r.output!.team_findings ?? ''].some((s) =>
      /manifund/i.test(s)
    )
  )
  // A fetched Manifund page counts as a leak even if the judge didn't flag it.
  const openedManifund = (r: EvalRow) => r.web_urls.some((u) => /manifund\.(org|com)/i.test(u))
  const textLeak = (r: EvalRow) => {
    const p = projects.get(r.project_id)
    return !!p && isPrearranged(p, screen)
  }
  const rows = args['include-leaked']
    ? all
    : all.filter((r) => !r.output!.outcome_leaked && !openedManifund(r) && !textLeak(r))
  const closed = rows
    .map((r) => ({ r, p: projects.get(r.project_id)! }))
    .filter(({ p }) => p && reachedMin(p.stage) !== null)
  const y = closed.map(({ p }) => reachedMin(p.stage)!)
  const prob = closed.map(({ r }) => r.output!.p_min_funding)
  const score = closed.map(({ r }) => r.output!.score)
  const rate = mean(y.map(Number))
  const brier = mean(prob.map((q, i) => (q - +y[i]) ** 2))
  const brierBase = mean(y.map((v) => (rate - +v) ** 2))
  const logLoss = -mean(
    prob.map((q, i) => {
      const c = Math.min(Math.max(q, 0.01), 0.99)
      return y[i] ? Math.log(c) : Math.log(1 - c)
    })
  )

  const out: string[] = []
  out.push(
    `## Run \`${runId}\` (${all[0]?.mode}, ${all[0]?.model_served}, effort ${all[0]?.effort})`
  )
  out.push(
    `${all.length} scored, total cost $${all.reduce((a, r) => a + r.cost_usd, 0).toFixed(2)}. ` +
      `${leaked.length} flagged outcome_leaked (${args['include-leaked'] ? 'included' : 'excluded'}). ` +
      (all[0]?.mode === 'web'
        ? `${manifundMentions.length} mention "manifund" in queries/URLs/findings. `
        : '') +
      `**${closed.length} closed** projects used below; actual rate reaching min ${fmt(rate * 100, 1)}%.`
  )
  out.push('')
  out.push('| Metric | Value |\n|---|---|')
  out.push(`| Mean predicted p | ${fmt(mean(prob))} |`)
  out.push(`| Brier (lower better) | ${fmt(brier)} |`)
  out.push(`| Brier of constant base rate | ${fmt(brierBase)} |`)
  out.push(`| Brier skill score | ${fmt(1 - brier / brierBase)} |`)
  out.push(`| Log loss | ${fmt(logLoss)} |`)
  out.push(`| AUC of p | ${fmt(auc(prob, y))} |`)
  out.push(`| AUC of score | ${fmt(auc(score, y))} |`)

  const withQ = closed.filter(({ p }) => p.quality_score != null)
  out.push(
    `| AUC of existing quality_score (same projects) | ${fmt(
      auc(
        withQ.map(({ p }) => p.quality_score!),
        withQ.map(({ p }) => reachedMin(p.stage)!)
      )
    )} |`
  )
  const allP = rows.map((r) => ({ r, p: projects.get(r.project_id)! })).filter(({ p }) => p)
  const q = allP.filter(({ p }) => p.quality_score != null)
  out.push(
    `| Spearman(score, quality_score), all scored | ${fmt(
      spearman(
        q.map(({ r }) => r.output!.score),
        q.map(({ p }) => p.quality_score!)
      )
    )} |`
  )
  out.push(
    `| Spearman(p, karma), all scored | ${fmt(
      spearman(
        allP.map(({ r }) => r.output!.p_min_funding),
        allP.map(({ p }) => p.karma)
      )
    )} |`
  )

  out.push(
    '\n**Reliability** (closed projects)\n\n| p bucket | n | mean p | actual |\n|---|---|---|---|'
  )
  const buckets = [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.01]
  for (let b = 0; b < buckets.length - 1; b++) {
    const idx = prob
      .map((v, i) => i)
      .filter((i) => prob[i] >= buckets[b] && prob[i] < buckets[b + 1])
    if (!idx.length) continue
    out.push(
      `| ${buckets[b]}–${Math.min(buckets[b + 1], 1)} | ${idx.length} | ${fmt(mean(idx.map((i) => prob[i])), 2)} | ${fmt(mean(idx.map((i) => +y[i])), 2)} |`
    )
  }

  out.push('\n**Outcome by score** (closed projects)\n\n| score | n | reached min |\n|---|---|---|')
  for (let s = 1; s <= 5; s++) {
    const idx = score.map((v, i) => i).filter((i) => score[i] === s)
    if (idx.length)
      out.push(`| ${s} | ${idx.length} | ${fmt(mean(idx.map((i) => +y[i])) * 100, 0)}% |`)
  }
  return { out: out.join('\n'), rows: all }
}

async function main() {
  const projects = new Map((await loadProjects()).map((p) => [p.id, p]))
  const runIds = args.run ?? listRuns()
  const reports = runIds.map((id) => report(id, projects))
  console.log(reports.map((r) => r.out).join('\n\n'))

  // Pairwise agreement between runs on the projects they share.
  for (let i = 0; i < reports.length; i++) {
    for (let j = i + 1; j < reports.length; j++) {
      const b = new Map(reports[j].rows.map((r) => [r.project_id, r]))
      const pairs = reports[i].rows
        .filter((r) => b.has(r.project_id))
        .map((r) => [r, b.get(r.project_id)!])
      if (pairs.length < 2) continue
      console.log(
        `\n**${runIds[i]} vs ${runIds[j]}** (${pairs.length} shared): ` +
          `Spearman p ${fmt(
            spearman(
              pairs.map(([a]) => a.output!.p_min_funding),
              pairs.map(([, c]) => c.output!.p_min_funding)
            )
          )}, ` +
          `mean |Δp| ${fmt(mean(pairs.map(([a, c]) => Math.abs(a.output!.p_min_funding - c.output!.p_min_funding))))}, ` +
          `same score ${fmt((100 * pairs.filter(([a, c]) => a.output!.score === c.output!.score).length) / pairs.length, 0)}%`
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
