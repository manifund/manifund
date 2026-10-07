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

export type Item = {
  name: string
  href?: string
  children?: Item[]
}

export function SidebarItem(props: { item: Item }) {
  const { item } = props
  const isCurrentPage = item.href === usePathname() && item.href != null
  const icon = findIcon(item.name, isCurrentPage)
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

function findIcon(name: string, isCurrentPage: boolean) {
  const styling = clsx(
    isCurrentPage ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500',
    '-ml-1 mr-3 h-6 w-6 flex-shrink-0' + 'h-6 w-6'
  )
  if (name.startsWith('Notifications')) return <BellIcon className={styling} />
  switch (name) {
    case 'Home':
      return <HomeIcon className={styling} />
    case 'Profile':
      return <UserCircleIcon className={styling} />
    case 'Projects':
      return <WrenchIcon className={styling} />
    case 'About':
      return <InformationCircleIcon className={styling} />
    case 'Categories':
      return <GlobeAltIcon className={styling} />
    case 'People':
      return <UserGroupIcon className={styling} />
    case 'Orgs':
      return <BuildingOffice2Icon className={styling} />
    case 'Login':
      return <UserCircleIcon className={styling} />
    case 'Newsletter':
      return <NewspaperIcon className={styling} />
    default:
      return null
  }
}
