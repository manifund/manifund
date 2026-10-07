'use client'

import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ReactNode, useEffect } from 'react'

// Routes that render as a standalone page: no sidebar, no bottom nav, white
// background, their own small header. Everything else keeps the app shell.
const STANDALONE_PREFIXES = ['/donor-survey']

export function useStandalone() {
  const pathname = usePathname() ?? ''
  return STANDALONE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function ShellChrome(props: { children: ReactNode }) {
  return useStandalone() ? null : <>{props.children}</>
}

// Routes whose pages have a right rail: the main column takes the grid's spare column, and on wide
// screens the empty strip beside the sidebar.
const WIDE_PREFIXES = ['/orgs/']

export function MainColumn(props: { children: ReactNode }) {
  const standalone = useStandalone()
  const pathname = usePathname() ?? ''
  const wide = WIDE_PREFIXES.some((p) => pathname.startsWith(p))
  // The body paints the app's gray canvas; standalone pages want white
  // edge to edge, beyond the main column's max width.
  useEffect(() => {
    if (!standalone) return
    document.body.classList.add('!bg-white')
    return () => document.body.classList.remove('!bg-white')
  }, [standalone])
  return (
    <main
      className={clsx(
        'flex flex-col',
        standalone
          ? 'min-h-screen bg-white lg:col-span-12'
          : wide
            ? 'lg:col-span-9 xl:-ml-16'
            : 'lg:col-span-8'
      )}
    >
      {props.children}
    </main>
  )
}
