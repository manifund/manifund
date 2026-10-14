'use client'
import { useState } from 'react'
import clsx from 'clsx'
import { BellSlashIcon, BoltIcon, CalendarDaysIcon } from '@heroicons/react/20/solid'
import type { EmailChoice } from '@/lib/notifications/kinds'

const OPTIONS: { choice: EmailChoice; label: string; Icon: typeof BoltIcon }[] = [
  { choice: 'immediate', label: 'Immediately', Icon: BoltIcon },
  { choice: 'daily', label: 'Daily', Icon: CalendarDaysIcon },
  { choice: 'never', label: 'Never', Icon: BellSlashIcon },
]

// The one email setting (N4), on the notifications page itself: how often optional notifications are also emailed.
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
    <section
      id="email"
      aria-labelledby="email-choice-label"
      className="mb-5 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 text-sm">
        <p id="email-choice-label" className="text-gray-700">
          Email me about replies, comments and what I follow
        </p>
        <p className="text-xs text-gray-500">
          Money, your projects and anything that needs you: always right away.
        </p>
        {error && <p className="text-xs text-red-700">Couldn't save. Try again.</p>}
      </div>
      <div
        role="radiogroup"
        aria-labelledby="email-choice-label"
        className="inline-flex flex-none self-start rounded-md border border-gray-200 bg-gray-50 p-0.5 sm:self-auto"
      >
        {OPTIONS.map(({ choice: c, label, Icon }) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            onClick={() => choice !== c && save(c)}
            className={clsx(
              'flex items-center gap-1 rounded px-2.5 py-1 text-xs',
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
    </section>
  )
}
