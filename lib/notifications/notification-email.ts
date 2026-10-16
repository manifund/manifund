// What goes into the "notification" Postmark template (TEMPLATE_IDS.NOTIFICATION), used for
// people you follow, saved searches, and the daily summary. The template holds the look (Manifund's grey page, white
// card, bold first line, orange button, footer); code only builds the content, as for "Generic notif (html)".
// Template variables: subject, heading (plain text), htmlContent, textContent, buttonUrl, buttonText, and footer
// ({ stopUrl, settingsUrl } for optional emails, added by templateEmail in notify.ts).
import { escapeHtml } from '@/utils/email'

export type NotificationContent = {
  subject: string
  heading: string // plain text: the template escapes it
  htmlContent: string // HTML, escaped by the caller
  textContent: string
  button: { url: string; text: string }
}

export function notificationModel(c: NotificationContent) {
  return {
    subject: c.subject,
    heading: c.heading,
    htmlContent: c.htmlContent,
    textContent: c.textContent,
    buttonUrl: c.button.url,
    buttonText: c.button.text,
  }
}

type Item = { who?: string; text: string; subject?: string; detail?: string; href: string }

// The daily summary's list: one row per notification with one bold orange link, on the thing it's about: the subject
// ("commented on **Open eval harness**"), or the project leading the line when there's no subject ("**Open eval
// harness** is active"), or else the whole line ("**Payment received: $500**").
export function summaryItems(items: Item[]): { html: string; text: string } {
  const link = (href: string, html: string, bold = false) =>
    `<a href="${escapeHtml(href)}" target="_blank" style="color: #ea580c; text-decoration: none;${bold ? ' font-weight: bold;' : ''}">${html}</a>`
  const html =
    `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 15px;">` +
    items
      .map(
        (i) =>
          `<tr><td style="padding: 10px 0; border-top: 1px solid #e9e9e9; line-height: 1.45em;">` +
          (i.subject
            ? `${i.who ? `<strong>${escapeHtml(i.who)}</strong> ` : ''}${escapeHtml(i.text)} ${link(i.href, escapeHtml(i.subject), true)}`
            : i.who
              ? `${link(i.href, escapeHtml(i.who), true)} ${escapeHtml(i.text)}`
              : link(i.href, escapeHtml(i.text), true)) +
          (i.detail
            ? `<div style="color: #777; font-size: 14px; margin-top: 2px;">${escapeHtml(i.detail)}</div>`
            : '') +
          `</td></tr>`
      )
      .join('') +
    `</table>`
  const text = items
    .map((i) => `- ${[i.who, i.text, i.subject].filter(Boolean).join(' ')}: ${i.href}`)
    .join('\n')
  return { html, text }
}
