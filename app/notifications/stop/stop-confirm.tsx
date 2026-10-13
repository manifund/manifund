'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/button'

export function StopConfirm(props: { token: string; labels: string[] }) {
  const [stopped, setStopped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async (undo: boolean) => {
    setError(null)
    const res = await fetch('/api/notifications/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: props.token, undo }),
    })
    if (res.ok) setStopped(!undo)
    else setError("That didn't work. Try again, or use your notification settings.")
  }
  return (
    <div className="flex flex-col gap-3 text-sm text-gray-700">
      <ul className="list-disc pl-5 font-medium">
        {props.labels.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {stopped ? (
        <p>
          You won't get these by email anymore; they still show in your notifications.{' '}
          <button onClick={() => send(true)} className="text-orange-600 hover:underline">
            Undo
          </button>
        </p>
      ) : (
        <Button onClick={() => send(false)} className="self-start">
          Unsubscribe from these emails
        </Button>
      )}
      {error && <p className="text-red-700">{error}</p>}
      <Link href="/settings/notifications" className="text-orange-600 hover:underline">
        All notification settings
      </Link>
    </div>
  )
}
