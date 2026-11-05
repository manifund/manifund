import { describe, expect, test } from 'bun:test'
import { checkLinks, extractLinks, suspiciousLink } from '@/app/utils/link-check'
import { withoutLinks } from '@/components/comments/held-notice'
import { isStale } from '@/lib/account-hold-status'
import { doc, docWithLink } from '../helpers/content'

const why = (href: string, text = 'click here') => suspiciousLink({ href, text })

describe('C39 the link check', () => {
  test('finds link marks and bare URLs', () => {
    expect(extractLinks(docWithLink('https://example.org/a', 'a paper'))).toEqual([
      { href: 'https://example.org/a', text: 'a paper' },
    ])
    expect(extractLinks(doc('see https://example.org/b, thanks')).map((l) => l.href)).toEqual([
      'https://example.org/b,',
    ])
  })
  test('holds a link whose text names another site', () => {
    expect(why('https://evil.example/login', 'manifund.org/verify')).toContain('reads as')
    expect(why('https://evil.example/login', 'https://stripe.com')).toContain('reads as')
  })
  test('holds raw IPs, punycode and look-alikes of the brands', () => {
    expect(why('http://192.168.4.20/x')).toContain('raw IP')
    expect(why('https://xn--manfund-b2a.org/')).toContain('international')
    expect(why('https://manifund-support.com/verify')).toContain('manifund')
    expect(why('https://manlfund.org/')).toContain('manifund')
    expect(why('https://paypal-refunds.net/')).toContain('paypal')
    expect(why('https://stripe.com.account-check.io/')).toContain('stripe')
    expect(why('https://coinbsae.com/')).toContain('coinbase')
  })
  test('lets ordinary links through', () => {
    for (const [href, text] of [
      ['https://manifund.org/projects/x', 'manifund.org/projects/x'],
      ['https://www.lesswrong.com/posts/abc', 'lesswrong.com'],
      ['https://nodejs.org', 'Node.js'],
      ['https://web.archive.org/web/2024/https://example.com/', 'example.com'],
      ['https://www.mercurynews.com/story', 'a story'],
      ['https://chromium.googlesource.com/x', 'source'],
      ['https://docs.google.com/document/d/1', 'our plan'],
      ['https://arxiv.org/abs/2401.00001', 'arxiv.org/abs/2401.00001'],
      ['mailto:me@example.org', 'email me'],
    ])
      expect(why(href, text)).toBeNull()
  })
  test('the whole document: a bad link anywhere holds it; no key means no lookup', async () => {
    delete process.env.GOOGLE_SAFE_BROWSING_API_KEY
    expect(await checkLinks(docWithLink('https://manifund-login.xyz', 'manifund.org'))).toContain(
      'link'
    )
    expect(await checkLinks(doc('Great project, how will you measure success?'))).toBeNull()
  })
})

describe('C40 a revealed phishing comment shows links as text', () => {
  test('drops link marks and keeps everything else', () => {
    const stripped = withoutLinks(docWithLink('https://evil.example', 'manifund.org'))!
    const node = stripped.content![0].content![0]
    expect(node.text).toBe('manifund.org')
    expect(node.marks).toEqual([])
  })
})

describe('U3 a rename is checked again', () => {
  const hold = { checked_username: 'maya', checked_full_name: 'Maya L', held_at: null, cleared_at: null }
  test('never checked, or a changed username or name, is stale', () => {
    expect(isStale({ username: 'maya', full_name: 'Maya L' }, null)).toBe(true)
    expect(isStale({ username: 'manifund_team', full_name: 'Maya L' }, hold)).toBe(true)
    expect(isStale({ username: 'maya', full_name: 'Manifund Support' }, hold)).toBe(true)
    expect(isStale({ username: 'maya', full_name: 'Maya L' }, hold)).toBe(false)
  })
})
