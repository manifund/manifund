import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import { loadNotifications } from '@/lib/notifications/load'
import { describe } from '@/lib/notifications/describe'
import { NotificationList } from './notification-list'
import { MarkRead } from './mark-read'

// Everything that happened to you, newest first, in one list (N5): no tabs, filters or grouping
// for now (Vals, 2026-10-05). Opening the page marks everything read (Vals, 2026-10-12).
export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) redirect('/login')
  const me = await getProfileById(supabase, user.id)
  const rows = await loadNotifications({ recipientId: user.id, limit: 100 })
  const items = rows.map((n) => ({
    id: n.id,
    unread: !n.read_at,
    createdAt: n.created_at,
    actor: n.actor,
    ...describe(n, { username: me?.username ?? '' }),
  }))
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium">Notifications</h1>
        <Link
          href="/settings/notifications"
          aria-label="Notification settings"
          className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-gray-800"
        >
          <Cog6ToothIcon className="h-5 w-5" />
        </Link>
      </div>
      {items.some((i) => i.unread) && <MarkRead />}
      <NotificationList items={items} />
    </div>
  )
}
