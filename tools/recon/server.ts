// Standalone local reconciliation tool. Run: bun tools/recon/server.ts
// Reads prod Supabase READ-ONLY; all tool state lives in tools/recon/data/*.json.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { join } from 'path'
import { parseCSV } from './lib/csv'
import {
  detectFormat,
  parseGeneric,
  parseMercury,
  parseStripe,
  parseStripeBalanceHistory,
  ColumnMapping,
} from './lib/parsers'
import { runAutoMatch, suggestFor } from './lib/match'
import { computeNav } from './lib/nav'
import { store } from './lib/store'
import { loadLocalConfig } from './lib/config'
import { BankTxn, Match, MATCH_TOLERANCE, MatchKind, PlatformTxn } from './lib/types'

config({ path: join(import.meta.dir, '..', '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BANK_ID = process.env.NEXT_PUBLIC_PROD_BANK_ID!
if (!SUPABASE_URL || !SERVICE_KEY || !BANK_ID) {
  console.error(
    'Missing env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_PROD_BANK_ID)'
  )
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
if (!loadLocalConfig())
  console.warn(
    'recon: running without account/payee config — mercury rows will import as off-sheet'
  )

let bankTxns: BankTxn[] = store.loadBankTxns()
let matches: Match[] = store.loadMatches()
let snapshots = store.loadSnapshots()
let platformTxns: PlatformTxn[] = store.loadPlatformCache<{ txns: PlatformTxn[] }>()?.txns ?? []

let idCounter = Date.now()
const newId = (p: string) => `${p}_${(idCounter++).toString(36)}`

async function refreshPlatform(): Promise<{ count: number }> {
  const raw: {
    id: string
    created_at: string
    amount: number
    type: string
    from_id: string | null
    to_id: string
  }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('txns')
      .select('id, created_at, amount, type, from_id, to_id')
      .eq('token', 'USD')
      .in('type', ['deposit', 'withdraw'])
      .or(`from_id.eq.${BANK_ID},to_id.eq.${BANK_ID}`)
      .order('created_at')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    raw.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const profileIds = [...new Set(raw.map((t) => (t.type === 'deposit' ? t.to_id : t.from_id!)))]
  const profiles = new Map<string, { username: string; full_name: string }>()
  const emails = new Map<string, string>()
  for (let i = 0; i < profileIds.length; i += 100) {
    const chunk = profileIds.slice(i, i + 100)
    const { data: ps } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', chunk)
    for (const p of ps ?? []) profiles.set(p.id, p)
    const { data: us } = await supabase.from('users').select('id, email').in('id', chunk)
    for (const u of us ?? []) if (u.email) emails.set(u.id, u.email)
  }
  platformTxns = raw.map((t) => {
    const profileId = t.type === 'deposit' ? t.to_id : t.from_id!
    const p = profiles.get(profileId)
    return {
      id: t.id,
      created_at: t.created_at,
      amount: t.amount,
      type: t.type as 'deposit' | 'withdraw',
      from_id: t.from_id,
      to_id: t.to_id,
      profileId,
      username: p?.username ?? profileId,
      fullName: p?.full_name ?? '',
      email: emails.get(profileId) ?? '',
    }
  })
  store.savePlatformCache({ fetchedAt: new Date().toISOString(), txns: platformTxns })
  return { count: platformTxns.length }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

function openPlatformTxns() {
  const linked = new Set(matches.flatMap((m) => m.platformTxnIds))
  return platformTxns.filter((t) => !linked.has(t.id))
}

function stateResponse() {
  const fetchedAt = store.loadPlatformCache<{ fetchedAt?: string }>()?.fetchedAt ?? null
  return json({ bankTxns, matches, snapshots, platformTxns, platformFetchedAt: fetchedAt })
}

const server = Bun.serve({
  port: 8787,
  hostname: '127.0.0.1',
  idleTimeout: 120,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    try {
      if (path === '/api/state') return stateResponse()

      if (path === '/api/refresh-platform' && req.method === 'POST') {
        const r = await refreshPlatform()
        return json(r)
      }

      if (path === '/api/import' && req.method === 'POST') {
        const body = (await req.json()) as {
          csv: string
          mapping?: ColumnMapping
          filename?: string
        }
        const { headers, rows } = parseCSV(body.csv)
        const format = detectFormat(headers)
        let parsed
        if (format === 'mercury') parsed = parseMercury(rows)
        else if (format === 'stripe') parsed = parseStripe(rows)
        else if (format === 'stripe_balance_history') {
          // determine which Stripe account by overlap of charge ids with already-imported rows
          const keys = new Set(
            rows.map((r) => 'stripe:' + r['Source']).filter((k) => k !== 'stripe:')
          )
          const overlap = { stripe_manifund: 0, stripe_mox: 0 }
          for (const t of bankTxns)
            if (
              (t.source === 'stripe_manifund' || t.source === 'stripe_mox') &&
              keys.has(t.dedupeKey)
            )
              overlap[t.source]++
          const source =
            overlap.stripe_manifund === 0 && overlap.stripe_mox === 0
              ? null
              : overlap.stripe_manifund >= overlap.stripe_mox
                ? ('stripe_manifund' as const)
                : ('stripe_mox' as const)
          if (!source)
            return json(
              {
                error:
                  'cannot tell which Stripe account this is — import its unified_payments export first',
              },
              400
            )
          parsed = parseStripeBalanceHistory(rows, source)
        } else if (body.mapping) parsed = parseGeneric(rows, body.mapping)
        else return json({ needsMapping: true, headers, sample: rows.slice(0, 3) })

        const existing = new Map(bankTxns.map((t) => [t.dedupeKey, t]))
        let inserted = 0
        let skipped = 0
        let updated = 0
        for (const r of parsed.rows) {
          const prior = existing.get(r.dedupeKey)
          if (prior) {
            // refresh amount/fee/raw for stripe rows (refund drift); never touch category/match
            if (
              r.dedupeKey.startsWith('stripe:') &&
              (prior.amount !== r.amount || prior.fee !== r.fee)
            ) {
              prior.amount = r.amount
              prior.fee = r.fee
              prior.raw = r.raw
              updated++
            } else skipped++
            continue
          }
          const txn: BankTxn = { ...r, id: newId('b') }
          bankTxns.push(txn)
          existing.set(txn.dedupeKey, txn)
          inserted++
        }
        store.saveBankTxns(bankTxns)
        return json({
          inserted,
          skipped: skipped + (parsed.rows.length - inserted - skipped - updated),
          updated,
          dropped: parsed.dropped,
          format: parsed.format,
          sourceCounts: parsed.sourceCounts,
          dateRange: parsed.dateRange,
        })
      }

      if (path === '/api/add-txn' && req.method === 'POST') {
        const body = (await req.json()) as {
          source: BankTxn['source']
          date: string
          amount: number
          description: string
        }
        if (!body.source || !body.date || !body.amount || !body.description)
          return json({ error: 'source, date, amount, description required' }, 400)
        const txn: BankTxn = {
          id: newId('b'),
          source: body.source,
          dedupeKey: `manual:${body.date}|${body.amount}|${body.description}|${idCounter}`,
          date: body.date,
          amount: body.amount,
          fee: 0,
          description: body.description,
          status: 'Manual',
          raw: { manual: 'true' },
        }
        bankTxns.push(txn)
        store.saveBankTxns(bankTxns)
        return json({ txn })
      }

      if (path === '/api/delete-txn' && req.method === 'POST') {
        const { id } = (await req.json()) as { id: string }
        const t = bankTxns.find((x) => x.id === id)
        if (!t) return json({ error: 'not found' }, 404)
        if (!t.dedupeKey.startsWith('manual:'))
          return json({ error: 'only manually added txns can be deleted' }, 400)
        if (t.matchId) return json({ error: 'unmatch it first' }, 400)
        bankTxns = bankTxns.filter((x) => x.id !== id)
        store.saveBankTxns(bankTxns)
        return json({ ok: true })
      }

      if (path === '/api/auto-match' && req.method === 'POST') {
        const result = runAutoMatch(bankTxns, platformTxns, matches)
        matches.push(...result.matches)
        for (const m of result.matches)
          for (const bid of m.bankTxnIds) {
            const t = bankTxns.find((x) => x.id === bid)
            if (t) t.matchId = m.id
          }
        store.saveBankTxns(bankTxns)
        store.saveMatches(matches)
        return json({
          phaseCounts: result.phaseCounts,
          newMatches: result.matches.length,
          suggestions: result.suggestions,
        })
      }

      if (path === '/api/suggest' && req.method === 'POST') {
        const { bankTxnId } = (await req.json()) as { bankTxnId: string }
        const t = bankTxns.find((x) => x.id === bankTxnId)
        if (!t) return json({ error: 'not found' }, 404)
        return json({ suggestions: suggestFor(t, openPlatformTxns()) })
      }

      if (path === '/api/match' && req.method === 'POST') {
        const body = (await req.json()) as {
          bankTxnIds: string[]
          platformTxnIds: string[]
          kind: MatchKind
          category?: string
          note?: string
          force?: boolean
          remainderToRevenue?: boolean
          uncredited?: number
        }
        let revenueRemainder: number | undefined
        let uncreditedRemainder: number | undefined
        const bankRows = body.bankTxnIds.map((id) => bankTxns.find((t) => t.id === id))
        if (bankRows.some((t) => !t || t.matchId))
          return json({ error: 'bank txn missing or already matched' }, 400)
        const linked = new Set(matches.flatMap((m) => m.platformTxnIds))
        if (body.platformTxnIds.some((id) => linked.has(id)))
          return json({ error: 'platform txn already matched' }, 400)
        if (body.kind === 'manual' || body.kind === 'auto') {
          if (bankRows.length === 0 && body.platformTxnIds.length > 0) {
            // platform-only group: deposit(s) and withdrawal(s) that cancel with no bank movement
            const platRows = body.platformTxnIds.map((id) => platformTxns.find((t) => t.id === id))
            if (platRows.some((p) => !p)) return json({ error: 'platform txn not found' }, 400)
            if (platRows.length < 2)
              return json(
                { error: 'platform-only match needs at least 2 rows (or use Paid off-platform)' },
                400
              )
            const net = platRows.reduce(
              (s, p) => s + (p!.type === 'deposit' ? p!.amount : -p!.amount),
              0
            )
            if (Math.abs(net) > MATCH_TOLERANCE) {
              // withdrawals exceeding re-credits: the difference stayed with Manifund
              if (body.remainderToRevenue && net < 0) revenueRemainder = -net
              else if (!body.force)
                return json(
                  {
                    error: `deposits and withdrawals do not cancel out: net ${net.toFixed(2)} — use force to override`,
                  },
                  400
                )
            }
          } else if (body.platformTxnIds.length > 0) {
            // compare signed bank flow against the net platform liability change
            // (deposits raise balances, withdrawals lower them) — supports mixed groups
            const bankNet = bankRows.reduce((s, t) => s + t!.amount, 0)
            const platNet = body.platformTxnIds.reduce((s, id) => {
              const p = platformTxns.find((t) => t.id === id)
              return s + (p ? (p.type === 'deposit' ? p.amount : -p.amount) : 0)
            }, 0)
            let delta = bankNet - platNet
            if (body.uncredited) {
              if (body.uncredited <= 0 || body.uncredited > delta + MATCH_TOLERANCE)
                return json(
                  {
                    error: `uncredited amount must be between 0 and the leftover ${delta.toFixed(2)}`,
                  },
                  400
                )
              uncreditedRemainder = body.uncredited
              delta -= body.uncredited
            }
            if (Math.abs(delta) > MATCH_TOLERANCE) {
              if (body.remainderToRevenue && delta > 0) revenueRemainder = delta
              else if (!body.force)
                return json(
                  {
                    error: `net mismatch: bank ${bankNet.toFixed(2)} vs platform ${platNet.toFixed(2)} (deposits − withdrawals) — use force to override`,
                  },
                  400
                )
            }
          } else {
            // bank-only group (e.g. donation in -> forwarded out): signed amounts should cancel
            const signedSum = bankRows.reduce((s, t) => s + t!.amount, 0)
            if (body.uncredited && bankRows.length === 1 && signedSum > 0) {
              // a lone inflow held for a platform account that does not exist yet
              if (Math.abs(signedSum - body.uncredited) > MATCH_TOLERANCE)
                return json(
                  { error: `uncredited amount must equal the inflow ${signedSum.toFixed(2)}` },
                  400
                )
              uncreditedRemainder = body.uncredited
            } else if (bankRows.length < 2)
              return json(
                { error: 'bank-only match needs at least 2 rows (or use No platform counterpart)' },
                400
              )
            if (!uncreditedRemainder && Math.abs(signedSum) > MATCH_TOLERANCE && !body.force)
              return json(
                {
                  error: `bank rows do not cancel out: net ${signedSum.toFixed(2)} — use force to override`,
                },
                400
              )
          }
        }
        const m: Match = {
          id: newId('m'),
          kind: body.kind,
          category: body.category,
          note: body.note,
          bankTxnIds: body.bankTxnIds,
          platformTxnIds: body.platformTxnIds,
          revenueRemainder,
          uncreditedRemainder,
          createdAt: new Date().toISOString(),
        }
        matches.push(m)
        for (const t of bankRows) t!.matchId = m.id
        store.saveBankTxns(bankTxns)
        store.saveMatches(matches)
        return json({ match: m })
      }

      if (path === '/api/update-note' && req.method === 'POST') {
        const { matchId, note } = (await req.json()) as { matchId: string; note: string }
        const m = matches.find((x) => x.id === matchId)
        if (!m) return json({ error: 'match not found' }, 404)
        m.note = note || undefined
        store.saveMatches(matches)
        return json({ ok: true })
      }

      if (path === '/api/unmatch' && req.method === 'POST') {
        const { matchId } = (await req.json()) as { matchId: string }
        matches = matches.filter((m) => m.id !== matchId)
        for (const t of bankTxns) if (t.matchId === matchId) t.matchId = undefined
        store.saveBankTxns(bankTxns)
        store.saveMatches(matches)
        return json({ ok: true })
      }

      if (path === '/api/category' && req.method === 'POST') {
        const { bankTxnIds, category } = (await req.json()) as {
          bankTxnIds: string[]
          category: string
        }
        for (const id of bankTxnIds) {
          const t = bankTxns.find((x) => x.id === id)
          if (t) {
            t.category = category || undefined
            t.categorySource = category ? 'manual' : undefined
          }
        }
        store.saveBankTxns(bankTxns)
        return json({ ok: true })
      }

      if (path === '/api/nav' && req.method === 'POST') {
        const { start, end } = (await req.json()) as { start: string; end: string }
        const prior = snapshots
          .filter((s) => s.month < start.slice(0, 7))
          .sort((a, b) => (a.month < b.month ? 1 : -1))[0]
        return json(computeNav(bankTxns, matches, platformTxns, [start, end], prior))
      }

      if (path === '/api/snapshot' && req.method === 'POST') {
        const body = (await req.json()) as {
          month: string
          balances: Record<string, number>
          computed: Record<string, unknown>
          note?: string
        }
        snapshots = snapshots.filter((s) => s.month !== body.month)
        snapshots.push({ ...body, savedAt: new Date().toISOString() })
        snapshots.sort((a, b) => (a.month < b.month ? -1 : 1))
        store.saveSnapshots(snapshots)
        return json({ ok: true })
      }

      // static files
      const file = path === '/' ? '/index.html' : path
      const f = Bun.file(join(import.meta.dir, 'public', file))
      if (await f.exists()) return new Response(f)
      return new Response('not found', { status: 404 })
    } catch (e) {
      console.error(e)
      return json({ error: String(e) }, 500)
    }
  },
})

console.log(`recon tool: http://localhost:${server.port}`)
if (platformTxns.length === 0) {
  console.log('fetching platform txns from prod (read-only)...')
  refreshPlatform()
    .then((r) => console.log(`cached ${r.count} platform txns`))
    .catch((e) => console.error('platform fetch failed:', e.message))
} else {
  console.log(`${platformTxns.length} platform txns from cache (use Refresh in UI to update)`)
}
