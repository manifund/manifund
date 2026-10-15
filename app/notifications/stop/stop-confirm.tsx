'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUturnLeftIcon, BellSlashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/button'
import { OPTIONAL_ABOUT } from '@/lib/notifications/kinds'

export function StopConfirm(props: { token: string }) {
  const [previous, setPrevious] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const send = async (undo?: string) => {
    setError(null)
    const res = await fetch('/api/notifications/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(undo ? { t: props.token, undo } : { t: props.token }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok)
      return setError("That didn't work. Try again, or change it on your notifications page.")
    setPrevious(undo ? null : (json.previous ?? 'daily'))
  }
  return (
    <div className="flex flex-col gap-3 text-sm text-gray-700">
      {previous ? (
        // the result replaces the question
        <p>
          You won't get these emails anymore. They still show in your notifications.{' '}
          <button
            onClick={() => send(previous)}
            className="inline-flex items-center gap-1 text-orange-600 hover:underline"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
            Undo
          </button>
        </p>
      ) : (
        <>
          <p>
            Stop emails about {OPTIONAL_ABOUT}? They still show in your notifications, and Manifund
            still emails you about money and your projects.
          </p>
          <Button onClick={() => send()} className="flex items-center gap-1.5 self-start">
            <BellSlashIcon className="h-4 w-4" />
            Unsubscribe
          </Button>
        </>
      )}
      {error && <p className="text-red-700">{error}</p>}
      <Link href="/notifications" className="text-orange-600 hover:underline">
        Your notifications
      </Link>
    </div>
  )
}
