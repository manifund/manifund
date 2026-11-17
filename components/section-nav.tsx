'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { ReactNode } from 'react'

// The sticky underline bar shared by org pages (which scroll between sections) and project pages
// (which switch tabs): an orange underline marks the current item, and a pill carries its count.
export function SectionNavBar(props: { children: ReactNode; className?: string }) {
  return (
    <nav
      aria-label="Sections"
      className={clsx(
        'sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200 bg-gray-50 px-4',
        props.className
      )}
    >
      {props.children}
    </nav>
  )
}

export function SectionNavItem(props: {
  href: string
  label: string
  stat?: string
  current: boolean
  // 'location' for a section in view, 'page' for the tab shown
  currentKind?: 'location' | 'page'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const { href, label, stat, current, currentKind = 'location', onClick } = props
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      onClick={onClick}
      aria-current={current ? currentKind : undefined}
      className={clsx(
        '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-3 pt-3 font-light transition-colors hover:text-gray-900 focus:outline-none focus-visible:bg-orange-50',
        current ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500'
      )}
    >
      <span>{label}</span>
      {stat && (
        <span
          className={clsx(
            'rounded-full px-2 py-1 text-[13px] font-normal tabular-nums leading-none',
            current ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-800'
          )}
        >
          {stat}
        </span>
      )}
    </Link>
  )
}
