'use client'
import { useEffect } from 'react'

// Profiles used to have tabs (?tab=by, ?tab=following): those links now go to the section, once it has
// streamed in.
const SECTION_FOR_TAB: Record<string, string> = {
  by: 'comments',
  comments: 'comments',
  following: 'about',
  projects: 'projects',
  donations: 'donations',
  transactions: 'transactions',
}

export function OldTabLink() {
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    const id = tab && SECTION_FOR_TAB[tab]
    if (!id || window.location.hash) return
    let tries = 0
    const timer = setInterval(() => {
      const el = document.getElementById(id)
      // A skeleton has the id too: wait for the real section
      if (el && !el.hasAttribute('aria-busy')) {
        el.scrollIntoView()
        clearInterval(timer)
      } else if (++tries > 50) clearInterval(timer)
    }, 100)
    return () => clearInterval(timer)
  }, [])
  return null
}
