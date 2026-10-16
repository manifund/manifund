// Compact side-by-side calibration and ranking comparison across runs, on the
// closed projects they all cover. Prearranged and leaked rows are excluded.
// bun tools/proposal-eval/compare.ts --run v2-text --run v3a-text [--run ...]
import { parseArgs } from 'util'
import { EvalRow, isPrearranged, loadProjects, reachedMin, readRows, readScreen } from './lib'

const { values: args } = parseArgs({ options: { run: { type: 'string', multiple: true } } })
const runIds = args.run ?? []
if (runIds.length < 2) throw new Error('pass at least two --run ids')

const latest = (id: string) => {
  const m = new Map<string, EvalRow>()
  for (const r of readRows(id)) if (r.output) m.set(r.project_id, r)
  return m
}
const runs = runIds.map((id) => [id, latest(id)] as const)
const screen = readScreen()
const projects = await loadProjects()
const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length
const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '-')

function ranks(xs: number[]) {
  const o = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0])
  const r = new Array(xs.length)
  for (let i = 0; i < o.length; ) {
    let j = i
    while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++
    for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r as number[]
}
const auc = (s: number[], y: boolean[]) => {
  const r = ranks(s)
  const np = y.filter(Boolean).length
  const nn = y.length - np
  return (r.filter((_, i) => y[i]).reduce((a, b) => a + b, 0) - (np * (np + 1)) / 2) / (np * nn)
}

// Only projects every run scored, so the columns are directly comparable.
const set = projects.filter(
  (p) =>
    reachedMin(p.stage) !== null &&
    !isPrearranged(p, screen) &&
    runs.every(([, m]) => m.has(p.id) && !m.get(p.id)!.output!.outcome_leaked)
)
const y = set.map((p) => reachedMin(p.stage)!)
const rate = mean(y.map(Number))
const brierBase = mean(y.map((v) => (rate - +v) ** 2))
console.log(
  `${set.length} closed projects scored by all runs; actual rate ${fmt(rate * 100, 1)}%\n`
)

const rows = runs.map(([id, m]) => {
  const p = set.map((x) => m.get(x.id)!.output!.p_min_funding)
  const brier = mean(p.map((q, i) => (q - +y[i]) ** 2))
  return {
    id,
    model: m.get(set[0].id)!.model_served ?? '',
    meanP: mean(p),
    brier,
    skill: 1 - brier / brierBase,
    aucP: auc(p, y),
    aucScore: auc(
      set.map((x) => m.get(x.id)!.output!.score),
      y
    ),
    over30: p.filter((q) => q >= 0.3).length,
    cost: readRows(id).reduce((a, r) => a + r.cost_usd, 0),
  }
})

const pad = (s: string, n: number) => s.padEnd(n)
console.log(
  pad('run', 14) +
    ['mean p', 'Brier', 'skill', 'AUC p', 'AUC score', 'p>=30%', 'cost']
      .map((h) => pad(h, 11))
      .join('')
)
for (const r of rows) {
  console.log(
    pad(r.id, 14) +
      pad(fmt(r.meanP * 100, 1) + '%', 11) +
      pad(fmt(r.brier, 4), 11) +
      pad(fmt(r.skill), 11) +
      pad(fmt(r.aucP), 11) +
      pad(fmt(r.aucScore), 11) +
      pad(String(r.over30), 11) +
      '$' +
      fmt(r.cost, 2)
  )
}
console.log(`\n(target mean p: ${fmt(rate * 100, 1)}%)`)

const buckets = [0, 0.1, 0.2, 0.3, 0.5, 1.01]
console.log('\nReliability: actual share funded per predicted bucket (n in brackets)')
console.log(
  pad('run', 14) +
    buckets
      .slice(0, -1)
      .map((b, i) => pad(`${b}-${Math.min(buckets[i + 1], 1)}`, 14))
      .join('')
)
for (const [id, m] of runs) {
  let line = pad(id, 14)
  for (let b = 0; b < buckets.length - 1; b++) {
    const idx = set
      .map((_, i) => i)
      .filter((i) => {
        const q = m.get(set[i].id)!.output!.p_min_funding
        return q >= buckets[b] && q < buckets[b + 1]
      })
    line += pad(
      idx.length ? `${fmt(mean(idx.map((i) => +y[i])) * 100, 0)}% [${idx.length}]` : '-',
      14
    )
  }
  console.log(line)
}

console.log('\nOutcome by score')
for (const [id, m] of runs) {
  const parts: string[] = []
  for (let s = 1; s <= 5; s++) {
    const idx = set.map((_, i) => i).filter((i) => m.get(set[i].id)!.output!.score === s)
    if (idx.length)
      parts.push(`${s}: ${fmt(mean(idx.map((i) => +y[i])) * 100, 0)}% (${idx.length})`)
  }
  console.log(pad(id, 14) + parts.join('  '))
}
