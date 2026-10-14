import Link from 'next/link'
import clsx from 'clsx'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { Avatar } from '@/components/avatar'
import { RelativeTime } from '@/components/relative-time'
import type { Described } from '@/lib/notifications/describe'

type Item = Described & {
  id: string
  unread: boolean
  createdAt: string
  actor: { id: string; username: string; avatar_url: string | null } | null
}

const ICONS = {
  'money-in': { Icon: ArrowDownTrayIcon, className: 'bg-emerald-50 text-emerald-700' },
  'money-out': { Icon: ArrowUpTrayIcon, className: 'bg-sky-50 text-sky-700' },
  check: { Icon: CheckIcon, className: 'bg-orange-50 text-orange-700' },
  alert: { Icon: ExclamationTriangleIcon, className: 'bg-amber-50 text-amber-700' },
  clock: { Icon: ClockIcon, className: 'bg-gray-100 text-gray-600' },
  doc: { Icon: DocumentTextIcon, className: 'bg-violet-50 text-violet-700' },
  search: { Icon: MagnifyingGlassIcon, className: 'bg-violet-50 text-violet-700' },
} as const

// What was new when the page opened stays highlighted until the next visit (opening it marks everything read, N2).
export function NotificationList(props: { items: Item[] }) {
  const { items } = props
  const unread = items.filter((i) => i.unread).length
  if (items.length === 0)
    return <p className="text-sm italic text-gray-500">No notifications yet.</p>
  return (
    <>
      <p className="mb-2 text-sm text-gray-500">{unread ? `${unread} new` : 'Nothing new'}</p>
      <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow">
        {items.map((n) => {
          const icon = n.icon !== 'avatar' ? ICONS[n.icon] : null
          return (
            <li key={n.id} className={clsx(n.unread && 'bg-orange-50')}>
              <Link href={n.href} className="flex gap-3 p-3">
                {icon ? (
                  <span
                    className={clsx(
                      'flex h-8 w-8 flex-none items-center justify-center rounded-full',
                      icon.className
                    )}
                  >
                    <icon.Icon className="h-4 w-4" />
                  </span>
                ) : n.actor ? (
                  <Avatar
                    username={n.actor.username}
                    avatarUrl={n.actor.avatar_url}
                    id={n.actor.id}
                    size="sm"
                    noLink
                  />
                ) : (
                  <span className="h-8 w-8 flex-none rounded-full bg-gray-100" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    {n.who && <span className="font-medium">{n.who}</span>} {n.text}{' '}
                    {n.subject && <span className="font-medium">{n.subject}</span>}
                  </p>
                  {n.detail && <p className="truncate text-gray-500">{n.detail}</p>}
                  <RelativeTime date={n.createdAt} className="text-xs text-gray-400" />
                </div>
                {n.unread && (
                  <span
                    aria-label="unread"
                    className="mt-1.5 h-2 w-2 flex-none rounded-full bg-orange-500"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
