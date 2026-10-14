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

// Everything that happened to you, newest first, in one list (N2): no tabs, filters or grouping
// for now (Vals, 2026-10-05). Opening the page marks everything read (Vals, 2026-10-12). The one email
// setting sits above the list (N4, Vals 2026-10-14): no separate settings page.
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
      <h1 className="mb-4 text-2xl font-medium">Notifications</h1>
      <EmailChoicePicker initial={emailChoice(stored)} />
      {items.some((i) => i.unread) && <MarkRead />}
      <NotificationList items={items} />
    </div>
  )
}
