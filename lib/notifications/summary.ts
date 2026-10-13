import { createAdminClient } from '@/db/supabase-admin'
import { escapeHtml, getUserEmail, sendEmail } from '@/utils/email'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { loadNotifications } from '@/lib/notifications/load'
import { describe, plainLine } from '@/lib/notifications/describe'
import { emailModeFor, groupOf, type NotificationReason } from '@/lib/notifications/groups'
import { emailLinks, loadOverrides, unsubscribeHeaders } from '@/lib/notifications/settings'
import { emailFooter } from '@/lib/notifications/footer'

// The weekly summary (cron, Mondays, N6): one email per person listing every notification waiting for it
// (email_status 'digest'), then marks them sent. A waiting notification whose group is now unsubscribed ('off',
// N7) is marked skipped without an email; one whose group switched to right away still goes out here, so
// nothing waits forever. Its unsubscribe button covers every kind it lists. Locally email is off.
export async function sendWeeklySummary() {
  const now = new Date().toISOString()
  const rows = await loadNotifications({ digestBefore: now, limit: 5000 })
  const byPerson = new Map<string, typeof rows>()
  for (const r of rows) byPerson.set(r.recipient_id, [...(byPerson.get(r.recipient_id) ?? []), r])
  const admin = createAdminClient() as any
  const base = getURL().replace(/\/$/, '')
  let people = 0
  let notifications = 0
  for (const [recipientId, waiting] of byPerson) {
    try {
      const overrides = await loadOverrides(recipientId)
      const off = waiting.filter(
        (n) => emailModeFor(n.reason as NotificationReason, overrides) === 'off'
      )
      const items = waiting.filter((n) => !off.includes(n))
      if (off.length) {
        await admin
          .from('notifications')
          .update({ email_status: 'skipped' })
          .in(
            'id',
            off.map((i) => i.id)
          )
      }
      if (!items.length) continue
      const email = await getUserEmail(admin, recipientId)
      const { data: me } = await admin
        .from('profiles')
        .select('username')
        .eq('id', recipientId)
        .single()
      if (email && me) {
        const lines = items.map((n) => {
          const d = describe(n, me)
          return { text: plainLine(d), href: `${base}${d.href}` }
        })
        const groups = [...new Set(items.map((n) => groupOf(n.reason as NotificationReason).key))]
        const links = await emailLinks(recipientId, groups)
        const footer = emailFooter(links)
        const html =
          `<p>What happened on Manifund this week:</p><ul>` +
          lines.map((l) => `<li><a href="${l.href}">${escapeHtml(l.text)}</a></li>`).join('') +
          `</ul><p><a href="${base}/notifications">All your notifications</a></p>` +
          footer.html
        const text = lines.map((l) => `- ${l.text}: ${l.href}`).join('\n') + footer.text
        await sendEmail(
          email,
          `Manifund: ${items.length} new this week`,
          html,
          text,
          undefined,
          undefined,
          { summary: 'weekly', recipient_id: recipientId },
          unsubscribeHeaders(links)
        )
      }
      await admin
        .from('notifications')
        .update({ email_status: email ? 'sent' : 'skipped', emailed_at: new Date().toISOString() })
        .in(
          'id',
          items.map((i) => i.id)
        )
      people++
      notifications += items.length
    } catch (e) {
      log.error('notifications.summary_failed', { recipient_id: recipientId, error: e })
    }
  }
  log.info('notifications.summary_sent', { people, notifications })
  return { people, notifications }
}
