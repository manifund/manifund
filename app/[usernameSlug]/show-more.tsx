'use client'
import { useState, useTransition } from 'react'
import clsx from 'clsx'
import type { Page } from './profile-data'

// A section's list: the first page from the server, then "Show more" asks for the next 25.
export function usePaged<T>(first: Page<T>, load: (offset: number) => Promise<Page<T>>) {
  const [items, setItems] = useState(first.items)
  const [next, setNext] = useState(first.next)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const more = () =>
    next !== null &&
    startTransition(async () => {
      try {
        const page = await load(next)
        setItems((all) => [...all, ...page.items])
        setNext(page.next)
        setError(false)
      } catch {
        setError(true)
      }
    })
  return { items, hasMore: next !== null, more, pending, error }
}

export function ShowMore(props: {
  shown: number
  total: number
  onClick: () => void
  pending: boolean
  error?: boolean
  className?: string
}) {
  const { shown, total, onClick, pending, error, className } = props
  const left = Math.max(total - shown, 0)
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-white px-4 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:text-gray-400"
      >
        {pending ? 'Loading…' : left > 0 ? `Show ${Math.min(left, 25)} more` : 'Show more'}
      </button>
      <span className="text-[13px] text-gray-400">
        {shown} of {total}
      </span>
      {error && <span className="text-[13px] text-rose-600">Couldn’t load more. Try again.</span>}
    </div>
  )
}
