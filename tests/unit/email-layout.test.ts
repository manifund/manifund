// The look of the emails #318 writes itself (lib/notifications/email-layout.ts): the templates' layout, escaped
// content, and the footer's unsubscribe links on optional emails only (N6).
import { describe, expect, test } from 'bun:test'
import { itemList, layoutEmail, layoutText } from '@/lib/notifications/email-layout'

const optional = {
  stopUrl: 'https://x/stop?t=1',
  oneClickUrl: 'https://x/one',
  settingsUrl: 'https://x/notifications',
}
const essential = { stopUrl: '', oneClickUrl: '', settingsUrl: '' }

describe('layoutEmail', () => {
  test("the templates' card, bold first line and orange button", () => {
    const html = layoutEmail({
      title: 'Subject',
      heading: 'Someone posted',
      body: '<p>Body</p>',
      button: { url: 'https://x/p', text: 'View project' },
      links: optional,
    })
    expect(html).toContain('background-color:#f6f6f6')
    expect(html).toContain('border:1px solid #e9e9e9')
    expect(html).toContain('<span style="font-weight:bold;">Someone posted</span>')
    expect(html).toContain('background-color:#ea580c')
    expect(html).toContain('View project')
  })
  test('optional emails link to unsubscribe and to the setting; essential ones say nothing about it', () => {
    const on = layoutEmail({ title: 't', heading: 'h', links: optional })
    expect(on).toContain('https://x/stop?t=1')
    expect(on).toContain('https://x/notifications')
    const off = layoutEmail({ title: 't', heading: 'h', links: essential })
    expect(off).not.toContain('unsubscribe')
    expect(off).toContain('our Discord')
  })
  test('the button text, link and title are escaped', () => {
    const html = layoutEmail({
      title: '<t>',
      heading: 'h',
      button: { url: 'https://x/"><script>', text: '<b>' },
      links: essential,
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
    expect(html).toContain('<title>&lt;t&gt;</title>')
  })
})

describe('itemList and layoutText', () => {
  test('a summary row links its subject, or its text when it has none; everything is escaped', () => {
    const html = itemList([
      { who: 'A<b>', text: 'commented on', subject: 'P & Q', href: 'https://x/p' },
      { who: 'B', text: 'commented on your profile', href: 'https://x/b' },
    ])
    expect(html).toContain('<strong>A&lt;b&gt;</strong>')
    expect(html).toMatch(/<a href="https:\/\/x\/p"[^>]*>P &amp; Q<\/a>/)
    expect(html).toMatch(/<a href="https:\/\/x\/b"[^>]*>commented on your profile<\/a>/)
  })
  test('the text part ends with the footer links for optional emails only', () => {
    expect(layoutText(['Hi'], optional)).toContain(
      'Unsubscribe from these emails: https://x/stop?t=1'
    )
    expect(layoutText(['Hi'], essential)).not.toContain('Unsubscribe')
  })
})
