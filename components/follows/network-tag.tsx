'use client'
import { createContext, useContext } from 'react'
import clsx from 'clsx'
import {
  ChatBubbleLeftEllipsisIcon,
  CurrencyDollarIcon,
  HandRaisedIcon,
  UsersIcon,
} from '@heroicons/react/16/solid'
import {
  andList,
  networkPeople,
  type NetworkActivity,
  type NetworkItem,
  type NetworkKind,
} from '@/lib/follows/network'

export type { NetworkActivity }

// What people the viewer follows did on each project (F8), loaded with the page.
export const NetworkContext = createContext<NetworkActivity | null>(null)

// A home card's context line, from the list's context (F8). It sits above the card, outside it, the way social
// feeds put "reposted by" above a post (Vals, 2026-10-14). Always renders a row, so cards side by side stay aligned
// (ProjectGroup gives each card a two-row subgrid).
export function NetworkTag(props: { projectId: string; className?: string }) {
  const network = useContext(NetworkContext)
  return (
    <div className={clsx('flex min-w-0 items-end', props.className)}>
      <NetworkLine items={network?.[props.projectId]} />
    </div>
  )
}

const KIND_ICON: Record<NetworkKind, typeof UsersIcon> = {
  commented: ChatBubbleLeftEllipsisIcon,
  donated: CurrencyDollarIcon,
  offered: HandRaisedIcon,
  created: UsersIcon,
}

// F8: "Maya donated and commented, Sam offered", names in a darker grey, after an icon for what they did (one kind for
// everyone) or a people icon (a mix). No "From your network" label; screen readers and the hover text say "People
// you follow". A card keeps it to one line; the project page wraps.
export function NetworkLine(props: {
  items: NetworkItem[] | undefined
  size?: 'xs' | 'sm'
  className?: string
}) {
  const { items, size = 'xs', className } = props
  const n = networkPeople(items)
  if (!n) return null
  const Icon = n.kind ? KIND_ICON[n.kind] : UsersIcon
  const words = n.shown.map((p) => `${p.name} ${andList(p.kinds)}`)
  const more = n.more ? ` and ${n.more} more` : ''
  return (
    <p
      title={`People you follow: ${words.join(', ')}${more}`}
      className={clsx(
        'flex min-w-0 items-center gap-1.5 text-gray-500',
        size === 'sm' ? 'text-sm' : 'px-1 text-xs',
        className
      )}
    >
      <Icon
        className={clsx('shrink-0 text-gray-400', size === 'sm' ? 'h-4 w-4' : 'h-3.5 w-3.5')}
        aria-hidden="true"
      />
      <span className="sr-only">People you follow: </span>
      <span className={size === 'xs' ? 'truncate' : undefined}>
        {n.shown.map((p, i) => (
          <span key={p.name}>
            {i > 0 && ', '}
            <span className="font-medium text-gray-700">{p.name}</span> {andList(p.kinds)}
          </span>
        ))}
        {more}
      </span>
    </p>
  )
}
