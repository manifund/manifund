import { createAdminClient } from '@/db/supabase-admin'
import { getUserEmail, TEMPLATE_IDS } from '@/utils/email'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { loadNotifications } from '@/lib/notifications/load'
import { describe } from '@/lib/notifications/describe'
import { emailModeFor, type NotificationReason } from '@/lib/notifications/kinds'
import { emailLinks, loadEmailChoices } from '@/lib/notifications/settings'
import { notificationModel, summaryItems } from '@/lib/notifications/notification-email'
import { templateEmail } from '@/lib/notifications/notify'

// The daily summary (cron, N5): one email per person listing every notification waiting for it (email_status
// 'digest'), then marks them sent, or failed with Postmark's answer when it refuses the email. If the person has switched to never since, what waits is marked skipped without
// an email; if they switched to immediate, it still goes out here, so nothing waits forever. Locally email is off.
export async function sendDailySummary() {
  const now = new Date().toISOString()
  const rows = await loadNotifications({ digestBefore: now, limit: 5000 })
  const byPerson = new Map<string, typeof rows>()
  for (const r of rows) byPerson.set(r.recipient_id, [...(byPerson.get(r.recipient_id) ?? []), r])
  const admin = createAdminClient()
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
      let error: string | null = null
      if (email && me) {
        const list = summaryItems(
          items.map((n) => {
            const d = describe(n, me)
            return { ...d, href: `${base}${d.href}` }
          })
        )
        const links = await emailLinks(recipientId, false)
        const result = await templateEmail(
          TEMPLATE_IDS.NOTIFICATION,
          notificationModel({
            subject: `Manifund: ${items.length} new since yesterday`,
            heading: 'Here’s what happened on Manifund since yesterday.',
            htmlContent: list.html,
            textContent: list.text,
            button: { url: `${base}/notifications`, text: 'View all notifications' },
          }),
          recipientId,
          email
        )(links)
        if (!result.ok) error = result.message
      }
      await admin
        .from('notifications')
        .update(
          !email
            ? { email_status: 'skipped', last_error: 'no email address' }
            : error
              ? { email_status: 'failed', last_error: error.slice(0, 300) }
              : { email_status: 'sent', emailed_at: new Date().toISOString() }
        )
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
