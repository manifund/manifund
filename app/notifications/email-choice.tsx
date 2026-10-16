'use client'
import { useState } from 'react'
import clsx from 'clsx'
import { BellSlashIcon, BoltIcon, CalendarDaysIcon } from '@heroicons/react/20/solid'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { OPTIONAL_ABOUT, type EmailChoice } from '@/lib/notifications/kinds'

const OPTIONS: { choice: EmailChoice; label: string; hint: string; Icon: typeof BoltIcon }[] = [
  // 'Instant' reads as a frequency next to Daily and Never, at about their length; the stored value stays
  // 'immediate'. Each choice explains itself in one sentence on hover.
  {
    choice: 'immediate',
    label: 'Instant',
    hint: 'An email for each notification, as it happens',
    Icon: BoltIcon,
  },
  {
    choice: 'daily',
    label: 'Daily',
    hint: 'One email a day with your new notifications',
    Icon: CalendarDaysIcon,
  },
  {
    choice: 'never',
    label: 'Never',
    hint: 'No emails, except about your money and your projects',
    Icon: BellSlashIcon,
  },
]

const SCOPE = `Emails about ${OPTIONAL_ABOUT}. Money and your projects are always emailed right away.`

// The one email setting (N4), in the notifications page's title row: how often optional
// notifications are also emailed. On a phone it wraps under the title.
export function EmailChoicePicker(props: { initial: EmailChoice }) {
  const [choice, setChoice] = useState(props.initial)
  const [error, setError] = useState(false)
  const save = async (next: EmailChoice) => {
    const before = choice
    setChoice(next)
    setError(false)
    const res = await fetch('/api/notifications/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice: next }),
    })
    if (!res.ok) {
      setChoice(before)
      setError(true)
    }
  }
  return (
    <section id="email" aria-label={SCOPE} className="flex flex-wrap items-center gap-2">
      <span title={SCOPE} className="flex items-center gap-1.5 text-xs text-gray-500">
        <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />
        Email
      </span>
      <div
        role="radiogroup"
        aria-label="Email"
        className="inline-flex flex-none rounded-md border border-gray-200 bg-gray-50 p-0.5"
      >
        {OPTIONS.map(({ choice: c, label, hint, Icon }) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            title={hint}
            onClick={() => choice !== c && save(c)}
            className={clsx(
              'flex items-center gap-1 rounded px-2 py-1 text-xs',
              choice === c
                ? 'bg-white font-medium text-orange-700 shadow-sm ring-1 ring-orange-200'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      {error && <p className="w-full text-xs text-red-700">Couldn't save. Try again.</p>}
    </section>
  )
}
