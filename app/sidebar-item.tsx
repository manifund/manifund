'use client'

import React from 'react'
import { useState } from 'react'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import {
  UserCircleIcon,
  WrenchIcon,
  InformationCircleIcon,
  HomeIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  GlobeAltIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  NewspaperIcon,
  BellIcon,
} from '@heroicons/react/24/outline'
import { SiteLink } from '@/components/site-link'
import { CountBadge, useUnreadAfterVisit } from '@/components/count-badge'

export type Item = {
  name: string
  href?: string
  children?: Item[]
  badge?: number | null // shown on the icon (the unread notifications count)
}

export function SidebarItem(props: { item: Item }) {
  const { item } = props
  const isCurrentPage = item.href === usePathname() && item.href != null
  const icon = findIcon(item.name, isCurrentPage, item.badge)
  const [isOpen, setIsOpen] = useState(false)

  const sidebarItem = (
    <div
      className={clsx(
        isCurrentPage ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100',
        'group flex cursor-pointer items-center rounded-md px-3 py-2 text-sm font-medium'
      )}
      aria-current={item.href == usePathname() ? 'page' : undefined}
      onClick={() => setIsOpen(!isOpen)}
    >
      {icon}
      <span className="truncate">{item.name}</span>
      {item.children &&
        (isOpen ? (
          <ChevronDownIcon className="ml-auto h-5 w-5" />
        ) : (
          <ChevronRightIcon className="ml-auto h-5 w-5" />
        ))}
    </div>
  )

  return (
    <div>
      {item.children ? (
        sidebarItem
      ) : (
        <SiteLink href={item.href} key={item.name}>
          {sidebarItem}
        </SiteLink>
      )}
      {isOpen && item.children && (
        <div className="ml-4">
          {item.children.map((subItem) => (
            <SidebarItem key={subItem.name} item={subItem} />
          ))}
        </div>
      )}
    </div>
  )
}

// The sidebar's notifications item: the bell with the unread count (C25).
export function NotificationsItem(props: { unread: number }) {
  const count = useUnreadAfterVisit(props.unread)
  return <SidebarItem item={{ name: 'Notifications', href: '/notifications', badge: count }} />
}

// Every item gets the same icon slot, so labels line up whether or not the bell carries a count;
// the count badge overlays the bell's corner and never pushes the label.
function findIcon(name: string, isCurrentPage: boolean, badge?: number | null) {
  const Icon = ICONS[name]
  if (!Icon) return null
  return (
    <span className="relative -ml-1 mr-3 h-6 w-6 flex-shrink-0">
      <Icon
        className={clsx(
          'h-6 w-6',
          isCurrentPage ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
        )}
      />
      {name === 'Notifications' && <CountBadge count={badge} />}
    </span>
  )
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home: HomeIcon,
  Profile: UserCircleIcon,
  Projects: WrenchIcon,
  About: InformationCircleIcon,
  Categories: GlobeAltIcon,
  People: UserGroupIcon,
  Orgs: BuildingOffice2Icon,
  Login: UserCircleIcon,
  Newsletter: NewspaperIcon,
  Notifications: BellIcon,
}
