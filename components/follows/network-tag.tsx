'use client'
import { createContext, useContext } from 'react'
import clsx from 'clsx'
import { UsersIcon } from '@heroicons/react/16/solid'
import {
  andList,
  networkPeople,
  type NetworkActivity,
  type NetworkItem,
} from '@/lib/follows/network'

export type { NetworkActivity }

// What people the viewer follows did on each project (F8), loaded with the page.
export const NetworkContext = createContext<NetworkActivity | null>(null)

// A home card's context line, from the list's context (F8). It sits above the card, outside it, the way social
// feeds put "reposted by" above a post (Vals, 2026-10-14), on a small white tab joined to the card's top edge so it
// reads as the card's (Vals asked for a visual connection, 2026-10-14). Always renders a row, so cards side by side
// stay aligned (ProjectGroup gives each card a two-row subgrid).
export function NetworkTag(props: { projectId: string; className?: string }) {
  const network = useContext(NetworkContext)
  const items = network?.[props.projectId]
  return (
    <div className={clsx('flex min-w-0 items-end', props.className)}>
      {networkPeople(items) && (
        <div className="relative z-[1] -mb-px ml-2 min-w-0 max-w-[calc(100%-1rem)] rounded-t-md bg-white px-2 pb-0.5 pt-1 shadow-[0_-1px_2px_rgba(0,0,0,0.06)]">
          <NetworkLine items={items} />
        </div>
      )}
    </div>
  )
}

// F8: "Maya donated and commented, Sam offered", names in a darker grey, after the two-people icon whatever they did
// (Vals, 2026-10-14). No "From your network" label; screen readers and the hover text say "People
// you follow". A card keeps it to one line; the project page wraps.
export function NetworkLine(props: {
  items: NetworkItem[] | undefined
  size?: 'xs' | 'sm'
  className?: string
}) {
  const { items, size = 'xs', className } = props
  const n = networkPeople(items)
  if (!n) return null
  const words = n.shown.map((p) => `${p.name} ${andList(p.kinds)}`)
  const more = n.more ? ` and ${n.more} more` : ''
  return (
    <p
      title={`People you follow: ${words.join(', ')}${more}`}
      className={clsx(
        'flex min-w-0 items-center gap-1.5 text-gray-500',
        size === 'sm' ? 'text-sm' : 'text-xs',
        className
      )}
    >
      <UsersIcon
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
