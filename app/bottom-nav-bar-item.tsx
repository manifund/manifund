'use client'
import { Transition, Dialog } from '@headlessui/react'
import {
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
  InformationCircleIcon,
  BellIcon,
} from '@heroicons/react/24/outline'
import { CountBadge, useUnreadAfterVisit } from '@/components/count-badge'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, Fragment } from 'react'
import { Item } from './bottom-nav-bar'
import { HomeIcon, GlobeAltIcon, UserCircleIcon } from '@heroicons/react/24/outline'

const itemClass =
  'sm:hover:bg-gray-200 block w-full py-1 px-2 text-center sm:hover:text-orange-600 transition-colors'
const selectedItemClass = 'bg-gray-100 text-orange-600'
const touchItemClass = 'bg-orange-100'

function findIcon(name: string) {
  return (
    {
      Home: HomeIcon,
      People: UserGroupIcon,
      Profile: UserCircleIcon,
      Categories: GlobeAltIcon,
      Create: PlusIcon,
      About: InformationCircleIcon,
      Notifications: BellIcon,
    }[name] ?? UserCircleIcon
  )
}

export function NavBarItem(props: { item: Item; children?: any; className?: string }) {
  const { item, children } = props
  const isCurrentPage = item.href === usePathname() && item.href != null
  const [touched, setTouched] = useState(false)
  const i = {
    icon: findIcon(item.name),
  }

  if (!item.href) {
    return (
      <button
        className={clsx(itemClass, touched && touchItemClass)}
        onTouchStart={() => setTouched(true)}
        onTouchEnd={() => setTouched(false)}
      >
        {<i.icon className="mx-auto my-1 h-6 w-6" />}
        {children}
        {item.name}
      </button>
    )
  }

  return (
    <Link
      href={item.href}
      className={clsx(itemClass, touched && touchItemClass, isCurrentPage && selectedItemClass)}
      onTouchStart={() => setTouched(true)}
      onTouchEnd={() => setTouched(false)}
    >
      <span className="relative mx-auto my-1 block h-6 w-6">
        <i.icon className="h-6 w-6" />
        <CountBadge count={item.badge} />
      </span>
      {children}
      {item.label ?? item.name}
    </Link>
  )
}

// The bottom bar's notifications item: the bell with the unread count (C25).
export function NotificationsNavItem(props: { unread: number }) {
  const count = useUnreadAfterVisit(props.unread)
  return (
    <NavBarItem
      item={{ name: 'Notifications', label: 'Alerts', href: '/notifications', badge: count }}
    />
  )
}

// Sidebar that slides out on mobile. Unused for now.
export function MobileSidebar(props: {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  children: React.ReactNode
}) {
  const { sidebarOpen, setSidebarOpen, children } = props
  return (
    <div>
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="fixed inset-0 z-50 flex" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-600 bg-opacity-75" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
              <Transition.Child
                as={Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute right-0 top-0 -mr-12 pt-2">
                  <button
                    type="button"
                    className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="sr-only">Close sidebar</span>
                    <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </button>
                </div>
              </Transition.Child>
              <div className="mx-2 h-0 flex-1 overflow-y-auto">{children}</div>
            </div>
          </Transition.Child>
          <div className="w-14 flex-shrink-0" aria-hidden="true">
            {/* Dummy element to force sidebar to shrink to fit close icon */}
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  )
}
