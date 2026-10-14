'use client'
// F5: "Notify me of new matches", on the line that appears under home's search box once there is a search (search
// text or categories). It saves them as a search, so new matching projects notify you (F6); while that search is
// saved, the line says so and offers to stop. Signed out, the button opens sign-up or sign-in, back to the same
// search. How often the emails come is the notification setting, not a choice here.
import { useState } from 'react'
import AuthModal from '@/components/auth/AuthModal'
import { BellIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon, BellSlashIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'

export type NotifyState = { searches: { id: string; query: string }[] }

export function SaveSearch(props: {
  account: NotifyState | null // null when signed out
  query: string // the search as a query string (lib/follows/match)
  summary: string // the search in words, for screen readers
  className?: string
}) {
  const { account, query, summary, className } = props
  const [searches, setSearches] = useState(account?.searches ?? [])
  const [signingIn, setSigningIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = searches.find((s) => s.query === query)

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true)
    setError(null)
    const ok = await action().catch(() => false)
    setBusy(false)
    if (!ok) setError('Could not save. Try again.')
  }
  const save = () =>
    run(async () => {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) return false
      const { search } = await res.json()
      setSearches([{ id: search.id, query: search.query }, ...searches])
      return true
    })
  const stop = (id: string) =>
    run(async () => {
      const res = await fetch('/api/saved-searches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setSearches(searches.filter((s) => s.id !== id))
      return res.ok
    })

  return (
    <div className={clsx('flex items-center gap-2 text-sm', className)}>
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {saved ? (
        <>
          <span className="flex items-center gap-1.5 text-orange-700" role="status">
            <BellAlertIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            Notifying you of new matches
            <span className="sr-only">: {summary}</span>
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => stop(saved.id)}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-60"
          >
            <BellSlashIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Stop
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={account ? save : () => setSigningIn(true)}
          className="-ml-2 flex items-center gap-1.5 sm:-mr-2 sm:ml-0 rounded-md px-2 py-1 font-medium text-orange-600 transition-colors hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.97] disabled:opacity-60"
        >
          <BellIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Notify me of new matches
          <span className="sr-only">: {summary}</span>
        </button>
      )}
      {signingIn && (
        <AuthModal
          isOpen
          onClose={() => setSigningIn(false)}
          next={window.location.pathname + window.location.search}
        />
      )}
    </div>
  )
}
