'use client'
import { createContext, useContext } from 'react'
import clsx from 'clsx'
import { UsersIcon } from '@heroicons/react/16/solid'
import { Avatar } from '@/components/avatar'
import {
  andList,
  moreText,
  networkPeople,
  networkText,
  type NetworkActivity,
  type NetworkItem,
} from '@/lib/follows/network'

export type { NetworkActivity }

// What people the viewer follows did on each project (F8), loaded with the page.
export const NetworkContext = createContext<NetworkActivity | null>(null)

// A home card's context line, from the list's context (F8). It sits above the card, outside it, the way social
// feeds put "reposted by" above a post: the people's faces and the sentence, on the page background with no band.
// Always renders a row, so cards side by side stay aligned (ProjectGroup gives each card a two-row subgrid).
export function NetworkTag(props: { projectId: string; className?: string }) {
  const network = useContext(NetworkContext)
  const items = network?.[props.projectId]
  return (
    <div className={clsx('flex min-w-0 items-end', props.className)}>
      {networkPeople(items) && <NetworkLine items={items} className="max-w-full px-1 pb-1.5" />}
    </div>
  )
}

// F8: "Maya donated and commented, Sam offered", names in a darker grey, after the shown people's faces (the
// two-people icon stands in if no face is known). No "From your network" label; screen readers and the hover text
// say "People you follow". A card keeps it to one line; the project page wraps.
export function NetworkLine(props: {
  items: NetworkItem[] | undefined
  size?: 'xs' | 'sm'
  className?: string
}) {
  const { items, size = 'xs', className } = props
  const n = networkPeople(items)
  if (!n) return null
  const faces = n.shown.filter((p) => p.avatar)
  return (
    <p
      title={`People you follow: ${networkText(items)}`}
      className={clsx(
        'flex min-w-0 items-center gap-2 text-gray-500',
        size === 'sm' ? 'text-sm' : 'text-xs',
        className
      )}
    >
      {faces.length ? (
        <span className="flex shrink-0 -space-x-1" aria-hidden="true">
          {faces.map((p) => (
            <Avatar
              key={p.name}
              username={p.name}
              id={p.avatar!.id}
              avatarUrl={p.avatar!.url}
              size={size === 'sm' ? 5 : 'xxs'}
              noLink
              className="rounded-full ring-2 ring-gray-50"
            />
          ))}
        </span>
      ) : (
        <UsersIcon
          className={clsx('shrink-0 text-gray-400', size === 'sm' ? 'h-4 w-4' : 'h-3.5 w-3.5')}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">People you follow: </span>
      <span className={size === 'xs' ? 'truncate' : undefined}>
        {n.shown.map((p, i) => (
          <span key={p.name}>
            {i > 0 && ', '}
            <span className="font-medium text-gray-700">{p.name}</span> {andList(p.kinds)}
          </span>
        ))}
        {moreText(n.more)}
      </span>
    </p>
  )
}
