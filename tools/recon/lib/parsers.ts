import { createHash } from 'crypto'
import { BankTxn, Source } from './types'

export type ParseResult = {
  format: 'mercury' | 'stripe' | 'stripe_balance_history' | 'coinbase' | 'unknown'
  rows: Omit<BankTxn, 'id'>[]
  dropped: number // rows excluded (pending/failed/uncaptured)
  sourceCounts: Record<string, number>
  dateRange: [string, string] | null
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24)

export function detectFormat(headers: string[]): ParseResult['format'] {
  if (headers.includes('Source Account') && headers.includes('Date (UTC)')) return 'mercury'
  if (
    headers.includes('id') &&
    headers.includes('Created date (UTC)') &&
    headers.includes('Captured')
  )
    return 'stripe'
  if (
    headers.includes('Type') &&
    headers.includes('Available On (UTC)') &&
    headers.includes('Source')
  )
    return 'stripe_balance_history'
  return 'unknown'
}

// last-4 -> source, injected from the local gitignored config (data/config.json)
let accountMap: Record<string, string> = {}

export function setAccountMap(map: Record<string, string>) {
  accountMap = map
}

function mercurySource(account: string): Source {
  const last4 = account.match(/xx(\d{4})/)?.[1]
  return ((last4 && accountMap[last4]) as Source) || 'mercury_other'
}

// Mercury "Date (UTC)" is MM-DD-YYYY; "Timestamp" is MM-DD-YYYY HH:MM:SS
function mercuryDate(row: Record<string, string>): string {
  const d = row['Date (UTC)'] ?? ''
  const [m, dd, y] = d.split('-')
  return `${y}-${m}-${dd}`
}

export function parseMercury(rows: Record<string, string>[]): ParseResult {
  const out: Omit<BankTxn, 'id'>[] = []
  let dropped = 0
  for (const r of rows) {
    if (r['Status'] !== 'Sent') {
      dropped++
      continue
    }
    const account = r['Source Account'] ?? ''
    const source = mercurySource(account)
    const description = r['Description'] || r['Bank Description'] || ''
    const trackingId = r['Tracking ID']?.trim()
    const dedupeKey =
      'mercury:' +
      (trackingId || sha([account, r['Timestamp'] ?? '', r['Amount'] ?? '', description].join('|')))
    out.push({
      source,
      dedupeKey,
      externalId: trackingId || undefined,
      date: mercuryDate(r),
      amount: parseFloat(r['Amount']),
      fee: 0,
      description,
      counterparty: r['Description'] || undefined,
      status: r['Status'],
      raw: r,
    })
  }
  return summarize('mercury', out, dropped)
}

export function parseStripe(rows: Record<string, string>[]): ParseResult {
  const out: Omit<BankTxn, 'id'>[] = []
  let dropped = 0
  for (const r of rows) {
    if (r['Captured'] !== 'true' || r['Status'] !== 'Paid') {
      dropped++
      continue
    }
    const source: Source = (r['Statement Descriptor'] ?? '').toUpperCase().includes('MOX')
      ? 'stripe_mox'
      : 'stripe_manifund'
    out.push({
      source,
      dedupeKey: 'stripe:' + r['id'],
      externalId: r['id'],
      date: (r['Created date (UTC)'] ?? '').slice(0, 10),
      amount: parseFloat(r['Amount']) - (parseFloat(r['Amount Refunded']) || 0),
      fee: parseFloat(r['Fee']) || 0,
      description: r['Description'] || r['Customer Email'] || '',
      counterparty: r['Customer Email'] || undefined,
      status: r['Status'],
      raw: r,
    })
  }
  return summarize('stripe', out, dropped)
}

// Stripe "Balance history" export: includes charges AND the outflows unified_payments lacks
// (payouts to bank, Stripe Connect transfers to users, Stripe fees). Source account is decided
// by the caller (overlap of charge ids with already-imported rows).
export function parseStripeBalanceHistory(
  rows: Record<string, string>[],
  source: Source
): ParseResult {
  const num = (s: string) => parseFloat((s ?? '').replace(/,/g, ''))
  const out: Omit<BankTxn, 'id'>[] = []
  let dropped = 0
  for (const r of rows) {
    const type = r['Type']
    const date = (r['Created (UTC)'] ?? '').slice(0, 10)
    const base = {
      source,
      date,
      fee: num(r['Fee']) || 0,
      status: 'Sent',
      raw: r,
    }
    if (type === 'charge' || type === 'payment') {
      // dedupe on the charge/payment id so rows already imported from unified_payments are skipped
      out.push({
        ...base,
        dedupeKey: 'stripe:' + r['Source'],
        externalId: r['Source'],
        amount: num(r['Amount']),
        description: r['email (metadata)'] || r['email_address (metadata)'] || 'Stripe charge',
        counterparty: r['email (metadata)'] || r['email_address (metadata)'] || undefined,
      })
    } else if (type === 'payout') {
      // payout to a bank account — internal transfer; pairs with the arrival row in Mercury
      out.push({
        ...base,
        dedupeKey: 'stripe:' + r['id'],
        externalId: r['Source'],
        amount: num(r['Amount']),
        description: 'Stripe payout to bank',
        category: 'internal_transfer',
        categorySource: 'auto',
      })
    } else if (type === 'transfer') {
      // Stripe Connect transfer paying a user directly — matchable against platform withdrawals
      out.push({
        ...base,
        dedupeKey: 'stripe:' + r['id'],
        externalId: r['Source'],
        amount: num(r['Amount']),
        description: 'Stripe Connect transfer (user payout)',
      })
    } else if (type === 'topup' || type === 'topup_reversal') {
      // bank -> Stripe balance top-up; pairs with the outgoing Mercury row
      out.push({
        ...base,
        dedupeKey: 'stripe:' + r['id'],
        externalId: r['Source'],
        amount: num(r['Amount']),
        description: type === 'topup' ? 'Stripe top-up from bank' : 'Stripe top-up reversal',
        category: 'internal_transfer',
        categorySource: 'auto',
      })
    } else if (type === 'stripe_fee') {
      out.push({
        ...base,
        dedupeKey: 'stripe:' + r['id'],
        amount: num(r['Amount']),
        description: 'Stripe fee',
        category: 'wire_fee',
        categorySource: 'auto',
      })
    } else {
      // refunds etc: unified_payments amounts are already net of refunds — skip to avoid double-counting
      dropped++
    }
  }
  return summarize('stripe_balance_history', out, dropped)
}

export type ColumnMapping = {
  dateCol: string
  amountCol: string
  descriptionCol: string
  idCol?: string
}

export function parseGeneric(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  source: Source = 'coinbase'
): ParseResult {
  const out: Omit<BankTxn, 'id'>[] = []
  const seen = new Map<string, number>()
  for (const r of rows) {
    const amount = parseFloat((r[mapping.amountCol] ?? '').replace(/[$,]/g, ''))
    if (Number.isNaN(amount)) continue
    const date = new Date(r[mapping.dateCol]).toISOString().slice(0, 10)
    const description = r[mapping.descriptionCol] ?? ''
    const id = mapping.idCol ? r[mapping.idCol] : undefined
    let dedupeKey: string
    if (id) dedupeKey = `${source}:${id}`
    else {
      // disambiguate identical same-day rows with an occurrence counter
      const base = [source, date, amount, description].join('|')
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      dedupeKey = `${source}:` + sha(`${base}|${n}`)
    }
    out.push({
      source,
      dedupeKey,
      externalId: id,
      date,
      amount,
      fee: 0,
      description,
      status: 'Sent',
      raw: r,
    })
  }
  return summarize('coinbase', out, rows.length - out.length)
}

function summarize(
  format: ParseResult['format'],
  rows: Omit<BankTxn, 'id'>[],
  dropped: number
): ParseResult {
  const sourceCounts: Record<string, number> = {}
  for (const r of rows) sourceCounts[r.source] = (sourceCounts[r.source] ?? 0) + 1
  const dates = rows.map((r) => r.date).sort()
  return {
    format,
    rows,
    dropped,
    sourceCounts,
    dateRange: dates.length ? [dates[0], dates[dates.length - 1]] : null,
  }
}
