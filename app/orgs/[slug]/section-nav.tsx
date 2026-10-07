'use client'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

export type Section = { id: string; label: string; stat?: string }

// The page is one long scroll; this bar jumps between its sections and marks the one in view.
export function SectionNav(props: { sections: Section[] }) {
  const { sections } = props
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    // The section in view is the last one whose top has passed under the bar.
    const onScroll = () => {
      let current = sections[0]?.id
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (el && el.getBoundingClientRect().top <= 140) current = section.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-10 -mx-4 mt-8 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200 bg-gray-50 px-4"
    >
      {sections.map((section) => {
        const on = section.id === active
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={on ? 'location' : undefined}
            className={clsx(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 pb-3 pt-3 font-light transition-colors hover:text-gray-900',
              on ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500'
            )}
          >
            <span>{section.label}</span>
            {section.stat && (
              <span
                className={clsx(
                  'rounded-full px-2 py-1 text-[13px] font-normal tabular-nums leading-none',
                  on ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-800'
                )}
              >
                {section.stat}
              </span>
            )}
          </a>
        )
      })}
    </nav>
  )
}
