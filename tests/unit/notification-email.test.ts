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
  test('each row has one bold link, on what it is about; everything is escaped', () => {
    const { html, text } = summaryItems([
      { who: 'A<b>', text: 'commented on', subject: 'P & Q', detail: 'Hi', href: 'https://x/p' },
      { who: 'Open eval harness', text: 'is active', href: 'https://x/o' },
      { text: 'Payment received: $5', href: 'https://x/m' },
    ])
    const bold = (href: string, label: string) =>
      new RegExp(
        `<a href="${href.replace(/[/.]/g, '\\$&')}"[^>]*font-weight: bold;[^>]*>${label}</a>`
      )
    expect(html).toContain('<strong>A&lt;b&gt;</strong> commented on')
    expect(html).toMatch(bold('https://x/p', 'P &amp; Q'))
    expect(html).toMatch(bold('https://x/o', 'Open eval harness'))
    expect(html).toContain('</a> is active')
    expect(html).toMatch(bold('https://x/m', 'Payment received: \\$5'))
    expect(text).toBe(
      '- A<b> commented on P & Q: https://x/p\n- Open eval harness is active: https://x/o\n- Payment received: $5: https://x/m'
    )
  })
})
