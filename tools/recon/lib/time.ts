import { BankTxn } from './types'

// UTC instant of a bank row, from the export's own timestamp column; null for manual rows
export function bankTxnTime(t: Pick<BankTxn, 'raw'>): string | null {
  const merc = t.raw['Timestamp'] // MM-DD-YYYY HH:MM:SS
  if (merc) {
    const [d, time] = merc.split(' ')
    const [m, dd, y] = d.split('-')
    return `${y}-${m}-${dd}T${time}Z`
  }
  const stripe = t.raw['Created date (UTC)'] ?? t.raw['Created (UTC)'] // YYYY-MM-DD HH:MM[:SS]
  if (stripe) return stripe.replace(' ', 'T') + (stripe.length === 16 ? ':00Z' : 'Z')
  return null
}

// Window bounds are a bare UTC date (whole day) or a full ISO instant. Rows with no
// timestamp fall back to comparing dates, so a manual row dated on a boundary day counts.
export function makeInWindow([start, end]: [string, string]) {
  const startAt = start.length === 10 ? `${start}T00:00:00.000Z` : new Date(start).toISOString()
  const endAt = end.length === 10 ? `${end}T23:59:59.999Z` : new Date(end).toISOString()
  const startDay = startAt.slice(0, 10)
  const endDay = endAt.slice(0, 10)
  return (date: string, at?: string | null) => {
    if (at) {
      const iso = new Date(at).toISOString()
      return iso >= startAt && iso <= endAt
    }
    return date >= startDay && date <= endDay
  }
}
