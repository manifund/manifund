import { createAdminClient } from '@/db/supabase-admin'
import { getUserEmail, sendEmail } from '@/utils/email'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { loadNotifications } from '@/lib/notifications/load'
import { describe, plainLine } from '@/lib/notifications/describe'
import { emailModeFor, type NotificationReason } from '@/lib/notifications/kinds'
import { emailLinks, loadEmailChoices, unsubscribeHeaders } from '@/lib/notifications/settings'
import { itemList, layoutEmail, layoutText } from '@/lib/notifications/email-layout'

// The daily summary (cron, N5): one email per person listing every notification waiting for it (email_status
// 'digest'), then marks them sent. If the person has switched to never since, what waits is marked skipped without
// an email; if they switched to immediate, it still goes out here, so nothing waits forever. Locally email is off.
export async function sendDailySummary() {
  const now = new Date().toISOString()
  const rows = await loadNotifications({ digestBefore: now, limit: 5000 })
  const byPerson = new Map<string, typeof rows>()
  for (const r of rows) byPerson.set(r.recipient_id, [...(byPerson.get(r.recipient_id) ?? []), r])
  const admin = createAdminClient() as any
  const base = getURL().replace(/\/$/, '')
  let people = 0
  let notifications = 0
  const choices = await loadEmailChoices([...byPerson.keys()])
  for (const [recipientId, waiting] of byPerson) {
    try {
      const off = waiting.filter(
        (n) => emailModeFor(n.reason as NotificationReason, choices.get(recipientId)) === 'never'
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
        const described = items.map((n) => {
          const d = describe(n, me)
          return { ...d, href: `${base}${d.href}` }
        })
        const links = await emailLinks(recipientId, false)
        const subject = `Manifund: ${items.length} new since yesterday`
        const html = layoutEmail({
          title: subject,
          heading: 'Here’s what happened on Manifund since yesterday.',
          body: itemList(described),
          button: { url: `${base}/notifications`, text: 'View all notifications' },
          links,
        })
        const text = layoutText(
          [
            'Here’s what happened on Manifund since yesterday:',
            '',
            ...described.map((d) => `- ${plainLine(d)}: ${d.href}`),
            '',
            `All your notifications: ${base}/notifications`,
          ],
          links
        )
        await sendEmail(
          email,
          subject,
          html,
          text,
          undefined,
          undefined,
          { summary: 'daily', recipient_id: recipientId },
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
