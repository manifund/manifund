'use client'
import { useState } from 'react'
import clsx from 'clsx'
import type { EmailChoice, EmailMode } from '@/lib/notifications/groups'

type Row = { key: string; section: string; label: string; mode: EmailMode }

const CHOICES: { mode: EmailChoice; label: string }[] = [
  { mode: 'instant', label: 'Right away' },
  { mode: 'weekly', label: 'Weekly' },
]

// Saves on change (no Save button); a failed save puts the old choice back and says so. A group unsubscribed from an
// email (N7) shows neither choice picked; picking one emails it again.
export function SettingsForm(props: { rows: Row[] }) {
  const [modes, setModes] = useState(Object.fromEntries(props.rows.map((r) => [r.key, r.mode])))
  const [error, setError] = useState<string | null>(null)
  const save = async (key: string, mode: EmailChoice) => {
    const before = modes[key]
    setModes((m) => ({ ...m, [key]: mode }))
    setError(null)
    const res = await fetch('/api/notifications/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: key, mode }),
    })
    if (!res.ok) {
      setModes((m) => ({ ...m, [key]: before }))
      setError("Couldn't save that change. Try again.")
    }
  }
  const sections = [...new Set(props.rows.map((r) => r.section))]
  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {sections.map((section) => (
        <section key={section} className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-1 text-sm font-medium text-gray-900">{section}</h2>
          <ul className="divide-y divide-gray-100">
            {props.rows
              .filter((r) => r.section === section)
              .map((r) => (
                <li
                  key={r.key}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-sm text-gray-700">
                    {r.label}
                    {modes[r.key] === 'off' && (
                      <span className="block text-xs text-gray-500">
                        Unsubscribed: no emails. Pick one to get them again.
                      </span>
                    )}
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={`Email: ${r.label}`}
                    className="flex overflow-hidden rounded-md border border-gray-200 text-xs"
                  >
                    {CHOICES.map((c) => (
                      <button
                        key={c.mode}
                        role="radio"
                        aria-checked={modes[r.key] === c.mode}
                        onClick={() => save(r.key, c.mode)}
                        className={clsx(
                          'border-l border-gray-200 px-2.5 py-1 first:border-l-0',
                          modes[r.key] === c.mode
                            ? 'bg-orange-50 font-medium text-orange-700'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
