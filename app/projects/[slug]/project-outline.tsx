'use client'
import clsx from 'clsx'
import { createContext, useContext, useEffect, useState } from 'react'
import type { Section } from '@/components/section-nav'

type Heading = { id: string; text: string; level: number }

const MIN_HEADINGS = 2

// The sections below the description (comments, offers, AI review…) stream in after the outline
// renders, so they hand their list up through here.
const OutlineSectionsContext = createContext<{
  sections: Section[]
  setSections: (sections: Section[]) => void
}>({ sections: [], setSections: () => {} })

export function OutlineSectionsProvider(props: { children: React.ReactNode }) {
  const [sections, setSections] = useState<Section[]>([])
  return (
    <OutlineSectionsContext.Provider value={{ sections, setSections }}>
      {props.children}
    </OutlineSectionsContext.Provider>
  )
}

export function useOutlineSections(sections: Section[]) {
  const { setSections } = useContext(OutlineSectionsContext)
  const key = JSON.stringify(sections)
  useEffect(() => {
    setSections(JSON.parse(key))
    return () => setSections([])
  }, [key, setSections])
}

// The description's headings, as a table of contents beside it (the way Substack and LessWrong do
// it), then the sections below it with their counts. Read from the rendered description, so it matches whatever the creator wrote; headings get
// ids here so the outline, and anyone sharing a link, can jump to them.
export function ProjectOutline(props: { containerId: string }) {
  const { containerId } = props
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string>()
  const { sections } = useContext(OutlineSectionsContext)
  const showHeadings = headings.length >= MIN_HEADINGS

  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return
    const used = new Set<string>()
    const found: Heading[] = []
    container.querySelectorAll<HTMLElement>('h1, h2, h3').forEach((el) => {
      const text = el.textContent?.trim()
      if (!text) return
      if (!el.id) {
        const base = slugify(text) || 'section'
        let id = base
        for (let i = 2; used.has(id) || document.getElementById(id); i++) id = `${base}-${i}`
        el.id = id
      }
      used.add(el.id)
      el.classList.add('scroll-mt-6')
      found.push({ id: el.id, text, level: Number(el.tagName[1]) })
    })
    setHeadings(found)
    // A shared link to a heading: its id exists only now, so the browser couldn't jump there itself.
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (hash && found.some((h) => h.id === hash)) document.getElementById(hash)?.scrollIntoView()
  }, [containerId])

  useEffect(() => {
    const ids = [...(showHeadings ? headings.map((h) => h.id) : []), ...sections.map((s) => s.id)]
    if (ids.length === 0) return
    // The current entry is the last one whose top has passed a third of the way down.
    const onScroll = () => {
      let current: string | undefined
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= window.innerHeight / 3) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headings, sections, showHeadings])

  if (!showHeadings && sections.length === 0) return null
  // Indent relative to the description's own top level, which is often h3.
  const topLevel = Math.min(...headings.map((h) => h.level))
  return (
    <nav aria-label="Outline" className="text-[13px] leading-snug">
      <ol className="flex flex-col border-l border-gray-200">
        {showHeadings &&
          headings.map((heading) => (
            <li key={heading.id}>
              <OutlineLink
                id={heading.id}
                on={heading.id === active}
                className={clsx('block', heading.level > topLevel ? 'pl-7' : 'pl-4')}
              >
                {heading.text}
              </OutlineLink>
            </li>
          ))}
        {showHeadings && sections.length > 0 && <li aria-hidden className="h-3" />}
        {sections.map((section) => {
          const on = section.id === active
          return (
            <li key={section.id}>
              <OutlineLink id={section.id} on={on} className="flex items-center gap-2 pl-4">
                <span className="min-w-0 flex-1">{section.label}</span>
                {section.stat && (
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-normal tabular-nums leading-none transition-colors',
                      on ? 'bg-orange-100 text-orange-700' : 'bg-orange-50 text-orange-800'
                    )}
                  >
                    {section.stat}
                  </span>
                )}
              </OutlineLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function OutlineLink(props: {
  id: string
  on: boolean
  className?: string
  children: React.ReactNode
}) {
  const { id, on, className, children } = props
  return (
    <a
      href={`#${id}`}
      aria-current={on ? 'location' : undefined}
      onClick={(e) => {
        e.preventDefault()
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
        window.history.replaceState(null, '', `${window.location.search}#${id}`)
      }}
      className={clsx(
        '-ml-px border-l-2 py-1.5 pr-2 transition-colors hover:text-gray-900',
        on ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500',
        className
      )}
    >
      {children}
    </a>
  )
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
