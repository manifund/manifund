'use client'
import { useEffect, useState } from 'react'
import { SectionNavBar, SectionNavItem } from '@/components/section-nav'

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
    <SectionNavBar className="mt-8">
      {sections.map((section) => (
        <SectionNavItem
          key={section.id}
          href={`#${section.id}`}
          label={section.label}
          stat={section.stat}
          current={section.id === active}
          onClick={(e) => {
            // Plain anchor jump, as before; Link with scroll={false} would skip it.
            e.preventDefault()
            document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })
            window.history.replaceState(null, '', `#${section.id}`)
          }}
        />
      ))}
    </SectionNavBar>
  )
}
