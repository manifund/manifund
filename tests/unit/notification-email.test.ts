// The content code builds for the "notification" Postmark template (lib/notifications/notification-email.ts); the
// template itself holds the look. Footer links are added by templateEmail for optional emails only (N6).
import { describe, expect, test } from 'bun:test'
import { notificationModel, summaryItems } from '@/lib/notifications/notification-email'

describe('notificationModel', () => {
  test("the template's variables", () => {
    expect(
      notificationModel({
        subject: 'S',
        heading: 'H',
        htmlContent: '<p>B</p>',
        textContent: 'B',
        button: { url: 'https://x/p', text: 'View project' },
      })
    ).toEqual({
      subject: 'S',
      heading: 'H',
      htmlContent: '<p>B</p>',
      textContent: 'B',
      buttonUrl: 'https://x/p',
      buttonText: 'View project',
    })
  })
})

describe('summaryItems', () => {
  test('a row links its subject, or its text when it has none; everything is escaped', () => {
    const { html, text } = summaryItems([
      { who: 'A<b>', text: 'commented on', subject: 'P & Q', detail: 'Hi', href: 'https://x/p' },
      { who: 'B', text: 'tipped you $5 for a comment', href: 'https://x/b' },
    ])
    expect(html).toContain('<strong>A&lt;b&gt;</strong>')
    expect(html).toMatch(/<a href="https:\/\/x\/p"[^>]*>P &amp; Q<\/a>/)
    expect(html).toMatch(
      /<a href="https:\/\/x\/b"[^>]*font-weight: bold;[^>]*>tipped you \$5 for a comment<\/a>/
    )
    expect(text).toBe(
      '- A<b> commented on P & Q: https://x/p\n- B tipped you $5 for a comment: https://x/b'
    )
  })
})
