import { SupabaseClient } from '@supabase/supabase-js'

// Formatting functions
const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

export function formatMoneyPrecise(amount: number) {
  const newAmount = getMoneyNumber(amount)
  return formatter.format(newAmount)
}

export function formatMoney(amount: number) {
  if (isNaN(amount)) return '$0'
  return `$${formatLargeNumber(amount)}`
}

export function getMoneyNumber(amount: number) {
  // Handle 499.9999999999999 case
  const plusEpsilon = (amount > 0 ? Math.floor : Math.ceil)(
    amount + 0.00000000001 * Math.sign(amount)
  )
  return Math.round(plusEpsilon) === 0 ? 0 : plusEpsilon
}

export const showPrecision = (x: number, sigfigs: number) =>
  // Convert back to number for weird formatting reason
  `${Number(x.toPrecision(sigfigs))}`

export const formatPercent = (x: number) => `${showPrecision(x * 100, 3)}%`

// Eg 1234567.89 => 1.23M; 5678 => 5.68K
export function formatLargeNumber(num: number, sigfigs = 2): string {
  const absNum = Math.abs(num)
  if (absNum < 1) return showPrecision(num, sigfigs)
  if (absNum < 100) return showPrecision(num, 2)

  const suffix = ['', 'K', 'M', 'B', 'T', 'Q']
  const i = Math.floor(Math.log10(absNum) / 3)

  const numStr = showPrecision(num / Math.pow(10, 3 * i), 3)
  return `${numStr}${suffix[i] ?? ''}`
}

// like formatLargeNumber but returns number instead of string
export function roundLargeNumber(num: number, sigfigs = 2): number {
  const absNum = Math.abs(num)
  if (absNum < 1) return Number(showPrecision(num, sigfigs))
  if (absNum < 100) return Number(showPrecision(num, 2))

  return Number(showPrecision(num, 3))
}

export function toTitleCase(string: string) {
  return string.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substring(1)
  })
}

export function toSentenceCase(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function formatDate(date: string) {
  const sections = date.split('-')
  let month = ''
  switch (sections[1]) {
    case '01':
      month = 'January'
      break
    case '02':
      month = 'February'
      break
    case '03':
      month = 'March'
      break
    case '04':
      month = 'April'
      break
    case '05':
      month = 'May'
      break
    case '06':
      month = 'June'
      break
    case '07':
      month = 'July'
      break
    case '08':
      month = 'August'
      break
    case '09':
      month = 'September'
      break
    case '10':
      month = 'October'
      break
    case '11':
      month = 'November'
      break
    case '12':
      month = 'December'
      break
  }
  return `${month} ${sections[2]}, ${sections[0]}`
}

// Pinned to UTC so server render and client hydration agree (React #418)
export function formatDateUtc(date: string | Date, options: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString('en-US', { timeZone: 'UTC', ...options })
}

export function addHttpToUrl(url: string) {
  const formattedUrl = url?.startsWith('http') ? url : `https://${url}`
  return formattedUrl
}

export async function projectSlugify(title: string, supabase: SupabaseClient) {
  let slug = title
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
  const { data } = await supabase.from('projects').select('slug').eq('slug', slug)
  if (data && data.length > 0) {
    slug = slug + '-' + Math.random().toString(36).substring(2, 15)
  }
  return slug
}

export function roundToNearestFive(n: number): number {
  return Math.round(n / 5) * 5
}
