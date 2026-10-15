// The look of emails we write ourselves (follows, saved searches, the daily summary): the same grey page, white card,
// bold first line, orange button and grey footer as Manifund's Postmark templates ("new comment", "received project
// donation"), so they read as one family (Vals, 2026-10-15: "emails count there"). Postmark keeps those templates;
// this is a copy of their look in code, so a change to them on Postmark should be mirrored here.
// All styles are inline: Postmark inlines CSS for templates only, and many mail apps drop <style>.
import { escapeHtml as escape } from '@/utils/email'
import type { EmailLinks } from './settings'

const FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;box-sizing:border-box;"
const ORANGE = '#ea580c'
const DISCORD = 'https://discord.gg/ZGsDMWSA5Q'

export type LayoutInput = {
  title: string // the <title>, usually the subject
  heading: string // HTML, escaped by the caller: the bold first line
  body?: string // HTML, escaped by the caller
  button?: { url: string; text: string }
  // Footer links for optional emails (N6): unsubscribe (sets the choice to never) and how often. Empty for
  // essential emails, which say nothing about unsubscribing.
  links: EmailLinks
}

export function layoutEmail({ title, heading, body, button, links }: LayoutInput): string {
  // the first line is 14px bold and the body 16px, as in the templates
  const row = (inner: string, style = '') =>
    `<tr><td style="${FONT}font-size:16px;vertical-align:top;padding:5px 0;${style}" valign="top">${inner}</td></tr>`
  const buttonHtml = button
    ? row(
        `<div align="center"><a href="${attr(button.url)}" target="_blank" style="${FONT}display:inline-block;` +
          `text-decoration:none;text-align:center;color:#ffffff;background-color:${ORANGE};border-radius:4px;` +
          `max-width:100%;word-break:break-word;"><span style="display:block;padding:10px 20px;line-height:120%;">` +
          `<span style="font-size:16px;font-weight:bold;line-height:18.8px;">${escape(button.text)}</span>` +
          `</span></a></div>`,
        'padding:20px 0 0 0;'
      )
    : ''
  const footerLink = (url: string, text: string) =>
    `<a href="${attr(url)}" target="_blank" style="color:#999;text-decoration:underline;">${text}</a>`
  const manage = links.stopUrl
    ? ` Or, ${footerLink(links.stopUrl, 'unsubscribe from these emails')}` +
      (links.settingsUrl
        ? `, or ${footerLink(links.settingsUrl, 'change how often you get them')}`
        : '') +
      '.'
    : ''
  return (
    `<!DOCTYPE html><html style="${FONT}font-size:14px;margin:0;"><head>` +
    `<meta name="viewport" content="width=device-width" />` +
    `<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />` +
    `<title>${escape(title)}</title>` +
    `<style type="text/css">img{max-width:100%;}body{-webkit-text-size-adjust:none;width:100%!important;` +
    `height:100%;line-height:1.6em;background-color:#f6f6f6;}` +
    `@media only screen and (max-width:640px){body{padding:0!important;}.container{padding:0!important;` +
    `width:100%!important;}.content{padding:0!important;}.content-wrap{padding:10px!important;}` +
    `.invoice{width:100%!important;}}</style></head>` +
    `<body style="${FONT}font-size:14px;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:none;` +
    `width:100%!important;height:100%;line-height:1.6em;background-color:#f6f6f6;margin:0;" bgcolor="#f6f6f6">` +
    `<table class="body-wrap" style="${FONT}font-size:14px;width:100%;background-color:#f6f6f6;margin:0;" bgcolor="#f6f6f6">` +
    `<tr><td></td><td class="container" width="600" style="${FONT}font-size:14px;vertical-align:top;` +
    `display:block!important;max-width:600px!important;clear:both!important;margin:0 auto;" valign="top">` +
    `<div class="content" style="${FONT}max-width:600px;display:block;margin:0 auto;padding:20px;">` +
    `<table class="main" width="100%" cellpadding="0" cellspacing="0" style="${FONT}border-radius:3px;` +
    `background-color:#fff;border:1px solid #e9e9e9;" bgcolor="#fff"><tr>` +
    `<td class="content-wrap" align="center" valign="top" style="${FONT}vertical-align:top;text-align:center;padding:20px;">` +
    `<table class="invoice" style="${FONT}font-size:16px;text-align:left;width:80%;margin:10px auto 40px;">` +
    row(`<span style="font-weight:bold;">${heading}</span>`, 'font-size:14px;') +
    (body ? row(`<div style="${FONT}font-size:16px;">${body}</div>`) : '') +
    buttonHtml +
    `</table></td></tr></table>` +
    `<div class="footer" style="${FONT}width:100%;clear:both;color:#999;padding:20px;">` +
    `<table width="100%"><tr><td align="center" valign="top" style="${FONT}font-size:12px;vertical-align:top;` +
    `color:#999;text-align:center;padding:0 0 20px;">Questions? Come ask in ` +
    `${footerLink(DISCORD, 'our Discord')}!${manage}</td></tr></table></div>` +
    `</div></td><td></td></tr></table></body></html>`
  )
}

// The plain-text part: the same words, then the footer links.
export function layoutText(lines: string[], links: EmailLinks): string {
  const footer = links.stopUrl
    ? [
        `Unsubscribe from these emails: ${links.stopUrl}`,
        ...(links.settingsUrl ? [`Change how often you get them: ${links.settingsUrl}`] : []),
      ]
    : []
  return [...lines, '', `Questions? Come ask in our Discord: ${DISCORD}`, ...footer].join('\n')
}

// A list for the daily summary: one row per notification, its subject linked (or its text, when it has none).
export function itemList(
  items: { who?: string; text: string; subject?: string; detail?: string; href: string }[]
): string {
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" style="${FONT}font-size:15px;border-collapse:collapse;">` +
    items
      .map(
        (i) =>
          `<tr><td style="${FONT}padding:10px 0;border-top:1px solid #e9e9e9;line-height:1.45em;">` +
          (i.who ? `<strong>${escape(i.who)}</strong> ` : '') +
          (i.subject
            ? `${escape(i.text)} ${link(i.href, escape(i.subject), 'font-weight:bold;')}`
            : link(i.href, escape(i.text))) +
          (i.detail
            ? `<div style="color:#777;font-size:14px;margin-top:2px;">${escape(i.detail)}</div>`
            : '') +
          `</td></tr>`
      )
      .join('') +
    `</table>`
  )
}

const attr = escape
const link = (url: string, html: string, style = '') =>
  `<a href="${attr(url)}" target="_blank" style="color:${ORANGE};text-decoration:none;${style}">${html}</a>`
