'use client'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

type Heading = { id: string; text: string; level: number }

const MIN_HEADINGS = 2

// The description's headings, as a table of contents beside it (the way Substack and LessWrong do
// it). Read from the rendered description, so it matches whatever the creator wrote; headings get
// ids here so the outline, and anyone sharing a link, can jump to them.
export function ProjectOutline(props: { containerId: string }) {
  const { containerId } = props
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string>()

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
    if (headings.length < MIN_HEADINGS) return
    // The current heading is the last one whose top has passed a third of the way down.
    const onScroll = () => {
      let current: string | undefined
      for (const heading of headings) {
        const el = document.getElementById(heading.id)
        if (el && el.getBoundingClientRect().top <= window.innerHeight / 3) current = heading.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headings])

  if (headings.length < MIN_HEADINGS) return null
  // Indent relative to the description's own top level, which is often h3.
  const topLevel = Math.min(...headings.map((h) => h.level))
  return (
    <nav aria-label="Outline" className="text-[13px] leading-snug">
      <ol className="flex flex-col border-l border-gray-200">
        {headings.map((heading) => {
          const on = heading.id === active
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={on ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })
                  window.history.replaceState(null, '', `${window.location.search}#${heading.id}`)
                }}
                className={clsx(
                  '-ml-px block border-l-2 py-1.5 pr-2 transition-colors hover:text-gray-900',
                  heading.level > topLevel ? 'pl-7' : 'pl-4',
                  on ? 'border-orange-500 text-gray-900' : 'border-transparent text-gray-500'
                )}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
