// Ledger simulator for autograntor estimates. Our own small take on the simulate.py in Scott Alexander's
// autograntor; see README.md for the format. The analytic mean is the headline; Monte Carlo quantiles are
// descriptive only.
//
//   bun tools/autograntor/simulate.ts <ledger.csv> [--size <amount>] [--draws N]
//   bun tools/autograntor/simulate.ts --diff <a.csv> <b.csv> --size <amount>

export const GROUPS = [
  'research',
  'uptake',
  'policy',
  'people',
  'audience',
  'community',
  'money',
  'exposure',
  'values',
  'other',
] as const
type Group = (typeof GROUPS)[number]

export type ExecSpec = { mean: number; p10: number; p90: number }

export type LedgerRow = {
  name: string
  size: number
  kind: 'event' | 'continuous' | 'charge'
  weight: number
  p1: number
  p0: number
  ev: number
  p10: number | null
  p90: number | null
  exec: string | null
  execMode: 'credit' | 'p1' | null
  group: Group
  post2030: number
}

export type Ledger = { rows: LedgerRow[]; exec: Record<string, ExecSpec> }

export type SizeResult = {
  size: number
  mean: number
  mc_mean: number
  median: number
  p10: number
  p90: number
  p_negative: number
  post2030_share: number
  groups: Record<string, number>
  rows: { name: string; group: string; mean: number }[]
}

const Z90 = 1.2815515655446004

// --- CSV ---

export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      out.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    out.push(row)
  }
  return out.filter((r) => r.some((f) => f.trim() !== '') && !r[0].trim().startsWith('#'))
}

const COLUMNS = [
  'name',
  'size',
  'kind',
  'weight',
  'p1',
  'p0',
  'ev',
  'p10',
  'p90',
  'exec',
  'exec_mode',
  'group',
  'post2030',
  'note',
]

export function parseLedger(text: string): Ledger {
  const [header, ...lines] = parseCsv(text)
  const cols = header.map((h) => h.trim())
  const missing = COLUMNS.filter((c) => !cols.includes(c))
  if (missing.length) throw new Error(`ledger is missing columns: ${missing.join(', ')}`)
  const errors: string[] = []
  const rows: LedgerRow[] = []
  const exec: Record<string, ExecSpec> = {}

  lines.forEach((cells, i) => {
    const get = (c: string) => (cells[cols.indexOf(c)] ?? '').trim()
    const num = (c: string) => (get(c) === '' ? null : Number(get(c).replace(/[_$]/g, '')))
    const where = `line ${i + 2} (${get('name') || 'unnamed'})`
    const kind = get('kind')

    if (kind === 'exec') {
      const spec = { mean: num('ev'), p10: num('p10'), p90: num('p90') }
      if (
        spec.mean === null ||
        spec.p10 === null ||
        spec.p90 === null ||
        !(0 < spec.p10 && spec.p10 < spec.mean && spec.mean < spec.p90 && spec.p90 < 1)
      ) {
        errors.push(`${where}: an exec row needs 0 < p10 < ev (the mean) < p90 < 1`)
      } else exec[get('name')] = spec as ExecSpec
      return
    }
    if (kind !== 'event' && kind !== 'continuous' && kind !== 'charge') {
      errors.push(`${where}: kind must be event, continuous, charge or exec`)
      return
    }
    const size = num('size')
    if (size === null || !Number.isFinite(size)) errors.push(`${where}: size must be a number`)
    const group = get('group') as Group
    if (!GROUPS.includes(group)) errors.push(`${where}: group must be one of ${GROUPS.join(', ')}`)
    const post2030 = num('post2030') ?? 0
    if (!(post2030 >= 0 && post2030 <= 1)) errors.push(`${where}: post2030 must be between 0 and 1`)
    const execName = get('exec') || null
    const execMode = (get('exec_mode') || null) as LedgerRow['execMode']

    const row: LedgerRow = {
      name: get('name'),
      size: size ?? 0,
      kind,
      weight: num('weight') ?? 0,
      p1: num('p1') ?? 0,
      p0: num('p0') ?? 0,
      ev: num('ev') ?? 0,
      p10: num('p10'),
      p90: num('p90'),
      exec: execName,
      execMode,
      group,
      post2030,
    }
    if (kind === 'event') {
      if (num('weight') === null) errors.push(`${where}: an event needs weight`)
      for (const p of [row.p1, row.p0])
        if (!(p >= 0 && p <= 1)) errors.push(`${where}: p1 and p0 must be between 0 and 1`)
      if (execName && execMode !== 'credit' && execMode !== 'p1')
        errors.push(`${where}: an event with exec needs exec_mode credit or p1`)
    } else {
      if (num('ev') === null) errors.push(`${where}: a ${kind} row needs ev`)
      if ((row.p10 === null) !== (row.p90 === null))
        errors.push(`${where}: give both p10 and p90, or neither`)
      if (row.p10 !== null && row.p90 !== null && !(row.p10 <= row.p90))
        errors.push(`${where}: p10 must be <= p90`)
      if (kind === 'charge' && execName)
        errors.push(`${where}: charges never take an execution factor`)
    }
    rows.push(row)
  })

  for (const r of rows)
    if (r.exec && !exec[r.exec]) errors.push(`${r.name}: no exec row named "${r.exec}"`)
  if (errors.length) throw new Error(`invalid ledger:\n  ${errors.join('\n  ')}`)
  return { rows, exec }
}

// --- analytic mean ---

export function rowMean(r: LedgerRow, exec: Record<string, ExecSpec>): number {
  const x = r.exec ? exec[r.exec].mean : 1
  if (r.kind === 'event') {
    if (r.exec && r.execMode === 'p1') return r.weight * (x * r.p1 - r.p0)
    return r.weight * x * (r.p1 - r.p0)
  }
  if (r.kind === 'continuous') return r.ev * x
  return r.ev
}

// --- sampling ---

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(u: () => number) {
  let a = 0
  while (a === 0) a = u()
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u())
}

function gamma(u: () => number, k: number): number {
  if (k < 1) return gamma(u, k + 1) * Math.pow(u() || 1e-12, 1 / k)
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    const z = normal(u)
    const v = Math.pow(1 + c * z, 3)
    if (v <= 0) continue
    if (Math.log(u() || 1e-12) < 0.5 * z * z + d - d * v + d * Math.log(v)) return d * v
  }
}

function beta(u: () => number, a: number, b: number) {
  const x = gamma(u, a)
  return x / (x + gamma(u, b))
}

function quantile(sorted: Float64Array, q: number) {
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo)
}

// Beta with the given mean whose p10-p90 width is closest to the requested one.
export function fitBeta(spec: ExecSpec): { a: number; b: number } {
  const target = spec.p90 - spec.p10
  let best = { a: spec.mean * 4, b: (1 - spec.mean) * 4, err: Infinity }
  for (let logK = Math.log(0.5); logK <= Math.log(2000); logK += 0.05) {
    const k = Math.exp(logK)
    const a = spec.mean * k
    const b = (1 - spec.mean) * k
    const u = rng(7)
    const xs = new Float64Array(4000)
    for (let i = 0; i < xs.length; i++) xs[i] = beta(u, a, b)
    xs.sort()
    const err = Math.abs(quantile(xs, 0.9) - quantile(xs, 0.1) - target)
    if (err < best.err) best = { a, b, err }
  }
  return { a: best.a, b: best.b }
}

// A sampler for a continuous or charge row with mean exactly ev. p10/p90 set the shape: lognormal when both are on
// the same side of zero, normal when they straddle it; the draw is then scaled so its mean is ev.
function amountSampler(r: LedgerRow): (u: () => number) => number {
  const { ev, p10, p90 } = r
  if (p10 === null || p90 === null || p10 === p90) return () => ev
  if (p10 < 0 && p90 > 0) {
    const sd = (p90 - p10) / (2 * Z90)
    return (u) => ev + sd * normal(u)
  }
  if (p10 === 0 || p90 === 0) {
    const sd = (p90 - p10) / (2 * Z90)
    return (u) => ev + sd * normal(u)
  }
  const sign = p90 < 0 ? -1 : 1
  const [lo, hi] = sign > 0 ? [p10, p90] : [-p90, -p10]
  const s = (Math.log(hi) - Math.log(lo)) / (2 * Z90)
  const mu = (Math.log(lo) + Math.log(hi)) / 2
  const scale = Math.abs(ev) / Math.exp(mu + (s * s) / 2)
  return (u) => sign * scale * Math.exp(mu + s * normal(u))
}

export function simulateSize(ledger: Ledger, size: number, draws = 200_000, seed = 1): SizeResult {
  const rows = ledger.rows.filter((r) => r.size === size)
  if (!rows.length) throw new Error(`no rows for size ${size}`)
  const means = rows.map((r) => rowMean(r, ledger.exec))
  const mean = means.reduce((s, m) => s + m, 0)

  const groups: Record<string, number> = {}
  rows.forEach((r, i) => (groups[r.group] = (groups[r.group] ?? 0) + means[i]))
  const post = rows.reduce((s, r, i) => s + means[i] * r.post2030, 0)

  const execNames = [...new Set(rows.map((r) => r.exec).filter(Boolean))] as string[]
  const betas = Object.fromEntries(execNames.map((n) => [n, fitBeta(ledger.exec[n])]))
  const samplers = rows.map((r) => (r.kind === 'event' ? null : amountSampler(r)))
  const u = rng(seed)
  const totals = new Float64Array(draws)
  const x: Record<string, number> = {}
  for (let d = 0; d < draws; d++) {
    for (const n of execNames) x[n] = beta(u, betas[n].a, betas[n].b)
    let total = 0
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const xi = r.exec ? x[r.exec] : 1
      if (r.kind === 'event') {
        const v = u()
        const p1 = r.exec && r.execMode === 'p1' ? xi * r.p1 : r.p1
        const factor = r.exec && r.execMode === 'credit' ? xi : 1
        total += r.weight * factor * ((v < p1 ? 1 : 0) - (v < r.p0 ? 1 : 0))
      } else total += samplers[i]!(u) * (r.kind === 'continuous' ? xi : 1)
    }
    totals[d] = total
  }
  const mcMean = totals.reduce((s, t) => s + t, 0) / draws
  const negatives = totals.reduce((s, t) => s + (t < 0 ? 1 : 0), 0)
  totals.sort()

  return {
    size,
    mean,
    mc_mean: mcMean,
    median: quantile(totals, 0.5),
    p10: quantile(totals, 0.1),
    p90: quantile(totals, 0.9),
    p_negative: negatives / draws,
    post2030_share: mean === 0 ? 0 : post / mean,
    groups,
    rows: rows
      .map((r, i) => ({ name: r.name, group: r.group, mean: means[i] }))
      .sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean)),
  }
}

export function sizesOf(ledger: Ledger) {
  return [...new Set(ledger.rows.map((r) => r.size))].sort((a, b) => a - b)
}

export function simulateLedger(ledger: Ledger, draws?: number) {
  return sizesOf(ledger).map((s) => simulateSize(ledger, s, draws))
}

// The agreement test: headline means within 30% of the larger (or both within 50 points of zero), the same
// largest group, and no group total differing by more than 30% of the larger mean.
export function compareLedgers(a: Ledger, b: Ledger, size: number) {
  const ra = simulateSize(a, size, 20_000)
  const rb = simulateSize(b, size, 20_000)
  const larger = Math.max(Math.abs(ra.mean), Math.abs(rb.mean))
  const meansClose =
    (Math.abs(ra.mean) < 50 && Math.abs(rb.mean) < 50) ||
    Math.abs(ra.mean - rb.mean) <= 0.3 * larger
  const top = (g: Record<string, number>) =>
    Object.entries(g).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0]?.[0]
  const sameTop = top(ra.groups) === top(rb.groups)
  const groups = GROUPS.map((g) => ({
    group: g,
    a: ra.groups[g] ?? 0,
    b: rb.groups[g] ?? 0,
  })).filter((g) => g.a !== 0 || g.b !== 0)
  const flagged = groups.filter((g) => Math.abs(g.a - g.b) > 0.3 * larger).map((g) => g.group)
  return {
    size,
    a: ra,
    b: rb,
    groups,
    checks: { meansClose, sameTop, topA: top(ra.groups), topB: top(rb.groups), flagged },
    agree: meansClose && sameTop && flagged.length === 0,
  }
}

// --- CLI ---

const fmt = (n: number) =>
  Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(Math.abs(n) >= 1 ? 1 : 3)

function printResult(r: SizeResult) {
  console.log(`\n## Size $${r.size.toLocaleString('en-US')}`)
  console.log(
    `mean ${fmt(r.mean)} (analytic; MC ${fmt(r.mc_mean)}) | median ${fmt(r.median)} | p10 ${fmt(r.p10)} | p90 ${fmt(r.p90)} | P(negative) ${(r.p_negative * 100).toFixed(1)}% | post-2030 ${(r.post2030_share * 100).toFixed(0)}% | per $1M ${fmt((r.mean / r.size) * 1e6)}`
  )
  console.log(
    'groups: ' +
      Object.entries(r.groups)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([g, v]) => `${g} ${fmt(v)}`)
        .join(', ')
  )
  console.log(
    'largest rows: ' +
      r.rows
        .slice(0, 5)
        .map((x) => `${x.name} ${fmt(x.mean)}`)
        .join('; ')
  )
}

export function resultSummary(results: SizeResult[]) {
  return results.map((r) => ({
    amount: r.size,
    mean: r.mean,
    median: r.median,
    p10: r.p10,
    p90: r.p90,
    p_negative: r.p_negative,
    post2030_share: r.post2030_share,
  }))
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const flag = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const load = async (p: string) => parseLedger(await Bun.file(p).text())
  try {
    if (args.includes('--help') || !args.length) {
      console.log(`Usage:
  bun tools/autograntor/simulate.ts <ledger.csv> [--size N] [--draws N]
  bun tools/autograntor/simulate.ts --diff <a.csv> <b.csv> --size N
Columns: ${COLUMNS.join(', ')}
Groups: ${GROUPS.join(', ')}
See tools/autograntor/README.md for what each column means.`)
    } else if (args[0] === '--diff') {
      const [a, b] = await Promise.all([load(args[1]), load(args[2])])
      const size = Number(flag('--size') ?? sizesOf(a)[0])
      const d = compareLedgers(a, b, size)
      console.log(
        `Size $${size.toLocaleString('en-US')}: A mean ${fmt(d.a.mean)}, B mean ${fmt(d.b.mean)}`
      )
      console.log('group        A            B')
      for (const g of d.groups)
        console.log(`${g.group.padEnd(12)} ${fmt(g.a).padStart(12)} ${fmt(g.b).padStart(12)}`)
      console.log(
        `means close: ${d.checks.meansClose} | largest group A ${d.checks.topA}, B ${d.checks.topB} | groups differing >30%: ${d.checks.flagged.join(', ') || 'none'}`
      )
      console.log(d.agree ? 'AGREE' : 'DIVERGE')
    } else {
      const ledger = await load(args[0])
      const draws = flag('--draws') ? Number(flag('--draws')) : undefined
      const size = flag('--size')
      const results = size
        ? [simulateSize(ledger, Number(size), draws)]
        : simulateLedger(ledger, draws)
      results.forEach(printResult)
      console.log(`\nRESULT_JSON ${JSON.stringify(resultSummary(results))}`)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}
