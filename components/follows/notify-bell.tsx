'use client'
// F5: the bell next to home's search box. It saves the current search text and categories as a search, so new
// matching projects notify you (F6). How often those emails come is the "saved searches" row of the notification
// settings (N3), not a choice here. Signed out, it says the same and offers to sign up or sign in, back to the same
// search.
import { Fragment, useState } from 'react'
import AuthModal from '@/components/auth/AuthModal'
import Link from 'next/link'
import { Popover, Transition } from '@headlessui/react'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'
import { PlusIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'

export type NotifyState = { searches: { id: string; query: string }[] }

export function NotifyBell(props: {
  account: NotifyState | null // null when signed out
  query: string // the search as a query string (lib/follows/match)
  summary: string // the search in words
}) {
  const { account, query, summary } = props
  const [searches, setSearches] = useState(account?.searches ?? [])
  const [signingIn, setSigningIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = searches.find((s) => s.query === query)
  const empty = query === ''

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
    <>
      <Popover className="relative flex">
        <Popover.Button
          aria-label={
            saved
              ? 'Notifying you about new projects like this'
              : 'Notify me about new projects like this'
          }
          // three looks: plain (nothing to save), a plus (this search can be saved), tinted (saved)
          className={clsx(
            'relative flex w-10 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 ring-inset transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.96]',
            saved
              ? 'bg-orange-50 text-orange-600 ring-orange-300'
              : empty
                ? 'bg-white text-gray-500 ring-gray-300'
                : 'bg-white text-gray-600 ring-gray-300'
          )}
        >
          {saved ? (
            <BellAlertIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          ) : (
            <BellIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          )}
          {!saved && !empty && (
            <span className="absolute bottom-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-orange-500 text-white ring-[1.5px] ring-white">
              <PlusIcon className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
          )}
        </Popover.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="-translate-y-1 opacity-0"
          enterTo="translate-y-0 opacity-100"
          leave="transition ease-in duration-100"
          leaveFrom="translate-y-0 opacity-100"
          leaveTo="opacity-0"
        >
          <Popover.Panel className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-xl bg-white p-4 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {empty ? (
              <>
                <p className="font-medium text-gray-900">Notify me about new projects</p>
                <p className="mt-1 text-gray-500">
                  Type a search or pick a category, then come back here to get an email when a new
                  project matches.
                </p>
              </>
            ) : !account ? (
              <>
                <p className="font-medium text-gray-900">Notify me about new projects like this</p>
                <p className="mt-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-gray-700">{summary}</p>
                <p className="mt-2 text-gray-500">Get an email when a new project matches.</p>
                {/* a Popover.Button, so the panel closes as the sign-in window opens */}
                <Popover.Button
                  onClick={() => setSigningIn(true)}
                  className="mt-3 w-full rounded-md bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600"
                >
                  Sign up or sign in
                </Popover.Button>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 font-medium text-gray-900">
                  {saved && <CheckIcon className="h-4 w-4 text-orange-600" aria-hidden="true" />}
                  {saved
                    ? 'Notifying you about new matches'
                    : 'Notify me about new projects like this'}
                </p>
                <p className="mt-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-gray-700">{summary}</p>
                {saved ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => stop(saved.id)}
                    className="mt-3 text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline disabled:opacity-60"
                  >
                    Stop notifying me about these
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={save}
                    className="mt-3 w-full rounded-md bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    Notify me
                  </button>
                )}
                {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
              </>
            )}
            {account && (
              <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
                <Link href="/settings/subscriptions" className="text-orange-600 hover:underline">
                  Your saved searches
                </Link>
                {' · '}
                <Link href="/settings/notifications" className="text-orange-600 hover:underline">
                  How often we email
                </Link>
              </p>
            )}
          </Popover.Panel>
        </Transition>
      </Popover>
      {signingIn && (
        <AuthModal
          isOpen
          onClose={() => setSigningIn(false)}
          next={window.location.pathname + window.location.search}
        />
      )}
    </>
  )
}
