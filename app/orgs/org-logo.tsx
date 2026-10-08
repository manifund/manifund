'use client'
import clsx from 'clsx'
import { useState } from 'react'

const TRACE_LOGOS = 'https://trace.manifund.org/logos'

// An org's logo: ours if we've set one, else the one Trace keeps for it, else the name on a dark tile
// (also when the image fails to load).
export function OrgLogo(props: {
  org: { name: string; logo_url: string | null; trace_slug: string | null }
  className?: string
}) {
  const { org, className } = props
  const candidates = [
    org.logo_url,
    org.trace_slug ? `${TRACE_LOGOS}/${org.trace_slug}.png` : null,
  ].filter((url): url is string => !!url)
  const [failed, setFailed] = useState(0)
  const src = candidates[failed]
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt=""
        onError={() => setFailed((n) => n + 1)}
        className={clsx('flex-none bg-white object-contain', className)}
      />
    )
  }
  // The name's first word, or its initials when that won't fit.
  const words = org.name.split(/\s+/)
  const text =
    words[0].length <= 5
      ? words[0]
      : words
          .map((word) => word[0])
          .join('')
          .slice(0, 4)
  return (
    <div
      className={clsx(
        'flex flex-none items-center justify-center bg-gray-900 font-medium uppercase tracking-wider text-white',
        className
      )}
    >
      {text}
    </div>
  )
}
