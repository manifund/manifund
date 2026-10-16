'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { RelativeTime } from '@/components/relative-time'
import type { NetworkFeedItem } from '@/db/network'
import { formatMoney } from '@/utils/formatting'

// F10: the home page's Network tab, what people you follow did lately. Loaded when the tab opens (home renders
// every tab up front, so this keeps the other tabs' page as it was).
export function NetworkFeed() {
  const [items, setItems] = useState<NetworkFeedItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    fetch('/api/network')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: { items: NetworkFeedItem[] }) => setItems(body.items))
      .catch(() => setFailed(true))
  }, [])

  if (failed)
    return <p className="text-center text-sm text-gray-500">Couldn't load your network.</p>
  if (!items)
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded bg-gray-100" />
        ))}
      </div>
    )
  if (items.length === 0)
    return (
      <div className="mx-auto max-w-md rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-600">
        <p className="font-medium text-gray-900">Nothing from your network yet</p>
        <p className="mt-2">
          Follow people with the Follow button on their profile to see their new projects, comments,
          donations and offers here.
        </p>
        <p className="mt-2">
          <Link href="/people" className="text-orange-600 hover:underline">
            Find people
          </Link>
        </p>
      </div>
    )
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="flex gap-3 py-3">
          <Avatar
            username={item.who.username}
            avatarUrl={item.who.avatar_url}
            id={item.who.id}
            size={8}
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-gray-700">
              <Link
                href={`/${item.who.username}`}
                className="font-medium text-gray-900 hover:underline"
              >
                {item.who.full_name || item.who.username}
              </Link>{' '}
              <Action item={item} />
              <RelativeTime date={item.at} className="ml-2 text-xs text-gray-400" />
            </p>
            {item.kind === 'commented' && item.excerpt && (
              <Link
                href={item.href}
                className="mt-1 line-clamp-2 block text-gray-500 hover:text-gray-700"
              >
                {item.excerpt}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

const LABELS: Record<string, string> = {
  'progress update': 'posted a progress update on',
  'final report': 'posted a final report on',
}

function Action(props: { item: NetworkFeedItem }) {
  const { item } = props
  const projectLink = (p: { title: string; slug: string }) => (
    <Link href={`/projects/${p.slug}`} className="font-medium text-orange-700 hover:underline">
      {p.title}
    </Link>
  )
  // The same words as notifications: "posted a new project:", "donated $X to", "offered $X on".
  if (item.kind === 'created') return <>posted a new project: {projectLink(item.project)}</>
  if (item.kind === 'donated')
    return (
      <>
        donated {formatMoney(item.amount)} to {projectLink(item.project)}
      </>
    )
  if (item.kind === 'offered')
    return (
      <>
        offered {formatMoney(item.amount)} on {projectLink(item.project)}
      </>
    )
  return (
    <>
      {(item.label && LABELS[item.label]) || 'commented on'}{' '}
      <Link href={item.href} className="font-medium text-orange-700 hover:underline">
        {item.target}
      </Link>
    </>
  )
}
