import type { JSONContent } from '@tiptap/core'

// Deterministic phishing-link check for comments (C39). Runs before the AI: a hit holds the comment
// on its own. Disguised userinfo links (https://manifund.org@evil/x) are already refused outright
// by checkContent (C37); these are the signals that are suspicious rather than malformed.

const BRANDS = ['manifund', 'stripe', 'paypal', 'coinbase', 'mercury', 'google']
// Distinctive enough that any domain containing them is suspect; the others ("google", "stripe",
// "mercury") appear in plenty of real domains, so for those only near-misspellings count.
const CONTAINED_BRANDS = ['manifund', 'paypal', 'coinbase']
// Domain-like link text only counts when it ends in a common TLD, so "Node.js" isn't a domain.
const TEXT_TLDS = new Set(
  'com org net io ai co gov edu app dev xyz info me us uk ca de fr eu ly gl to site online top'.split(' ')
)
// The real sites for each brand; anything else carrying the brand name is a lookalike.
const BRAND_DOMAINS = new Set([
  'manifund.org',
  'manifund.com',
  'stripe.com',
  'paypal.com',
  'coinbase.com',
  'mercury.com',
  'google.com',
  'share.google',
  'goo.gl',
  'youtube.com',
  'googleusercontent.com',
  'googleapis.com',
  'blog.google',
  'googlesource.com',
  'withgoogle.com',
  'g.co',
])

export type LinkRef = { href: string; text: string }

export function extractLinks(doc: JSONContent | null | undefined): LinkRef[] {
  const links: LinkRef[] = []
  const walk = (node: JSONContent) => {
    const link = node.marks?.find((m) => m.type === 'link')
    const href = (link?.attrs as { href?: unknown } | undefined)?.href
    if (typeof href === 'string') links.push({ href, text: node.text ?? '' })
    else if (node.type === 'text' && node.text) {
      for (const m of node.text.matchAll(/\bhttps?:\/\/[^\s<>"')\]]+/gi))
        links.push({ href: m[0], text: m[0] })
    }
    for (const child of node.content ?? []) walk(child)
  }
  if (doc) walk(doc)
  return links
}

function hostOf(href: string): string | null {
  try {
    const url = new URL(href.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

// The registrable-ish part: the last two labels (good enough for lookalike comparisons).
function baseDomain(host: string) {
  return host.split('.').slice(-2).join('.')
}

// A domain written in the link text, e.g. "manifund.org/verify" or "https://stripe.com".
function domainInText(text: string): string | null {
  const m = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+([a-z]{2,}))(?:[/:?#]\S*)?$/i.exec(text.trim())
  if (!m || !TEXT_TLDS.has(m[2].toLowerCase())) return null
  return m[1].toLowerCase()
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        // a swap of two neighbouring letters is one typo (coinbsae)
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : Infinity
      )
  return d[a.length][b.length]
}

function isBrandHost(host: string) {
  return [...BRAND_DOMAINS].some((d) => host === d || host.endsWith(`.${d}`))
}

// Why a link looks like phishing, or null.
export function suspiciousLink({ href, text }: LinkRef): string | null {
  const host = hostOf(href)
  if (!host) return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('['))
    return `links to a raw IP address (${host})`
  if (host.split('.').some((label) => label.startsWith('xn--')))
    return `uses a look-alike international domain (${host})`

  const shown = domainInText(text)
  // An archive or redirect link that names the shown site in its address is fine.
  if (shown && baseDomain(shown) !== baseDomain(host) && !href.toLowerCase().includes(shown))
    return `reads as "${shown}" but goes to "${host}"`

  if (!isBrandHost(host)) {
    const labels = host.split('.')
    const name = labels.length > 1 ? labels[labels.length - 2] : host
    for (const brand of BRANDS) {
      // stripe.com.example.io, or paypal-login.example
      if (labels.some((l) => l === brand || (CONTAINED_BRANDS.includes(brand) && l.includes(brand))))
        return `imitates ${brand} (${host})`
      const near = brand === 'manifund' ? 2 : 1
      if (name !== brand && name.length >= 5 && editDistance(name, brand) <= near)
        return `imitates ${brand} (${host})`
    }
  }
  return null
}

const SAFE_BROWSING_TIMEOUT_MS = 3000

// Google Safe Browsing v4 lookup. Missing key, errors and timeouts count as no match.
export async function safeBrowsingMatches(urls: string[]): Promise<string[]> {
  const key = process.env.GOOGLE_SAFE_BROWSING_API_KEY
  if (!key || urls.length === 0) return []
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(SAFE_BROWSING_TIMEOUT_MS),
        body: JSON.stringify({
          client: { clientId: 'manifund', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: urls.slice(0, 500).map((url) => ({ url })),
          },
        }),
      }
    )
    if (!res.ok) {
      console.error('Safe Browsing lookup failed:', res.status, await res.text())
      return []
    }
    const json = (await res.json()) as { matches?: { threat?: { url?: string } }[] }
    return (json.matches ?? []).map((m) => m.threat?.url ?? '').filter(Boolean)
  } catch (e) {
    console.error('Safe Browsing lookup errored:', e)
    return []
  }
}

// The first reason any link in the document looks like phishing, or null.
export async function checkLinks(doc: JSONContent | null | undefined): Promise<string | null> {
  const links = extractLinks(doc)
  for (const link of links) {
    const why = suspiciousLink(link)
    if (why) return `link ${why}`
  }
  const urls = [...new Set(links.map((l) => l.href.trim()).filter((h) => hostOf(h)))]
  const bad = await safeBrowsingMatches(urls)
  return bad.length ? `link flagged by Google Safe Browsing (${hostOf(bad[0]) ?? bad[0]})` : null
}
