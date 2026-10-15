import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import { loadNotifications } from '@/lib/notifications/load'
import { describe } from '@/lib/notifications/describe'
import { NotificationList } from './notification-list'
import { MarkRead } from './mark-read'
import { EmailChoicePicker } from './email-choice'
import { loadEmailChoice } from '@/lib/notifications/settings'
import { emailChoice } from '@/lib/notifications/kinds'

// Everything that happened to you, newest first, in one list: no tabs, filters or grouping (N2; Vals 2026-10-05,
// day groups tried and dropped 2026-10-15). Opening the page marks everything read (Vals, 2026-10-12). The one
// email setting sits in the title row (N4, Vals 2026-10-14/15): no separate settings page.
export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) redirect('/login')
  const me = await getProfileById(supabase, user.id)
  const [rows, stored] = await Promise.all([
    loadNotifications({ recipientId: user.id, limit: 100 }),
    loadEmailChoice(user.id),
  ])
  const items = rows.map((n) => ({
    id: n.id,
    unread: !n.read_at,
    createdAt: n.created_at,
    actor: n.actor,
    ...describe(n, { username: me?.username ?? '' }),
  }))
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-2xl font-medium">Notifications</h1>
        <EmailChoicePicker initial={emailChoice(stored)} />
      </div>
      {items.some((i) => i.unread) && <MarkRead />}
      <NotificationList items={items} />
    </div>
  )
}
