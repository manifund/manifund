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

// Money and your projects' timeline get an orange icon; saved-search matches stay grey, and what other people did
// shows their avatar (Vals, 2026-10-15, option A of design-core-notifications-page).
const ORANGE = 'bg-orange-50 text-orange-600'
const ICONS = {
  'money-in': { Icon: ArrowDownTrayIcon, className: ORANGE },
  'money-out': { Icon: ArrowUpTrayIcon, className: ORANGE },
  check: { Icon: CheckIcon, className: ORANGE },
  alert: { Icon: ExclamationTriangleIcon, className: ORANGE },
  clock: { Icon: ClockIcon, className: ORANGE },
  doc: { Icon: DocumentTextIcon, className: ORANGE },
  search: { Icon: MagnifyingGlassIcon, className: 'bg-gray-100 text-gray-500' },
} as const

// What was new when the page opened keeps a thin orange rule until the next visit (opening it marks everything read,
// N2). One list, newest first: no day groups (Vals, 2026-10-15: "not simple, not necessary").
export function NotificationList(props: { items: Item[] }) {
  const { items } = props
  if (items.length === 0)
    return <p className="text-sm italic text-gray-500">No notifications yet.</p>
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60">
      {items.map((n) => (
        <Row key={n.id} n={n} />
      ))}
    </ul>
  )
}

function Row({ n }: { n: Item }) {
  const icon = n.icon !== 'avatar' ? ICONS[n.icon] : null
  return (
    <li className="relative">
      {n.unread && (
        <span
          aria-label="new"
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-orange-500"
        />
      )}
      <Link href={n.href} className="flex gap-3 py-3 pl-4 pr-3 hover:bg-gray-50">
        {icon ? (
          <span
            className={clsx(
              'mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full',
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
        <div className="min-w-0 flex-1 text-sm leading-5 text-gray-700">
          <p>
            {n.who && <span className="font-medium text-gray-900">{n.who}</span>} {n.text}{' '}
            {n.subject && <span className="font-medium text-gray-900">{n.subject}</span>}
          </p>
          {n.detail && <p className="mt-0.5 truncate text-gray-500">{n.detail}</p>}
          <RelativeTime date={n.createdAt} className="mt-0.5 block text-xs text-gray-400" />
        </div>
      </Link>
    </li>
  )
}
