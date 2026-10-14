import type { EmailLinks } from './settings'

// The footer of emails we write ourselves (N6). Optional kinds: an unsubscribe button (sets the one choice to
// never) and a link to change how often. Essential kinds (empty links): no footer at all, nothing about
// unsubscribing (Vals, 2026-10-07).
export function emailFooter(links: EmailLinks): { html: string; text: string } {
  const parts: string[] = []
  const text: string[] = []
  if (links.stopUrl) {
    parts.push(
      `<a href="${links.stopUrl}" style="display:inline-block;padding:6px 12px;border:1px solid #d1d5db;` +
        `border-radius:6px;color:#374151;text-decoration:none">Unsubscribe</a>`
    )
    text.push(`Unsubscribe: ${links.stopUrl}`)
  }
  if (links.settingsUrl) {
    parts.push(
      `<a href="${links.settingsUrl}" style="color:#ea580c">Change how often you get these emails</a>`
    )
    text.push(`Change how often you get these emails: ${links.settingsUrl}`)
  }
  if (!parts.length) return { html: '', text: '' }
  return {
    html: `<p style="margin-top:24px;font-size:12px;color:#6b7280">${parts.join('&nbsp;&nbsp;')}</p>`,
    text: `\n\n${text.join('\n')}`,
  }
}
