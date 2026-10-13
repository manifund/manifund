'use client'
import { createContext, useContext } from 'react'
import clsx from 'clsx'
import { UsersIcon } from '@heroicons/react/16/solid'
import { networkText, type NetworkActivity } from '@/lib/follows/network'

export type { NetworkActivity }

// What people the viewer follows did on each project (F8), loaded with the page.
export const NetworkContext = createContext<NetworkActivity | null>(null)

// A home card's network line, from the list's context.
export function NetworkTag(props: { projectId: string; className?: string }) {
  const network = useContext(NetworkContext)
  return <NetworkLine text={networkText(network?.[props.projectId])} className={props.className} />
}

// F8: "Maya donated and commented, Sam offered", after a people icon instead of a "From your network" label. The
// label stays for screen readers and on hover.
export function NetworkLine(props: {
  text: string | null
  size?: 'xs' | 'sm'
  className?: string
}) {
  const { text, size = 'xs', className } = props
  if (!text) return null
  return (
    <p
      title={`People you follow: ${text}`}
      className={clsx(
        'flex min-w-0 items-center gap-1 text-orange-700',
        size === 'sm' ? 'text-sm' : 'text-xs',
        className
      )}
    >
      <UsersIcon
        className={clsx('shrink-0 text-orange-500', size === 'sm' ? 'h-4 w-4' : 'h-3.5 w-3.5')}
        aria-hidden="true"
      />
      <span className="sr-only">People you follow: </span>
      {/* a card keeps it to one line (the full text on hover); the project page wraps */}
      <span className={size === 'xs' ? 'truncate' : undefined}>{text}</span>
    </p>
  )
}
