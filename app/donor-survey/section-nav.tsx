'use client'

import clsx from 'clsx'
import { useEffect, useState } from 'react'

export type NavItem = { id: string; title: string; meta?: React.ReactNode }

// The section currently on screen: the last one whose top has passed a line
// a third of the way down the window.
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join(',')
  useEffect(() => {
    const onScroll = () => {
      const line = window.scrollY + window.innerHeight * 0.35
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top + window.scrollY <= line) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return active
}

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Wide screens only: a list of the page's sections in the empty margin left
// of the 640px column, where other pages have the sidebar.
export function SectionNav(props: { items: NavItem[] }) {
  const active = useActiveSection(props.items.map((i) => i.id))
  return (
    <nav
      aria-label="Sections"
      className="fixed top-28 hidden w-[190px] min-[1180px]:block"
      style={{ left: 'max(24px, calc(50% - 320px - 56px - 190px))' }}
    >
      <ul className="flex flex-col gap-0.5 border-l border-gray-100 text-sm">
        {props.items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToSection(item.id)
              }}
              className={clsx(
                '-ml-px flex items-center justify-between gap-2 border-l-2 py-1.5 pl-3 hover:no-underline',
                item.id === active
                  ? 'border-orange-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              )}
            >
              <span>{item.title}</span>
              {item.meta}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
