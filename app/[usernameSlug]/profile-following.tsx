'use client'
import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import {
  ArrowUturnLeftIcon,
  BookmarkSlashIcon,
  ChevronDownIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/20/solid'
import { Avatar } from '@/components/avatar'
import type { Following, SavedSearch } from '@/db/following'

// The Following section of a profile (F9): the people and projects someone follows, for everyone to see, and on
// your own profile your saved searches (private) and the buttons to change all three. Something you remove stays
// in the list, faded, with "Undo", until the page reloads.

async function send(url: string, method: string, body: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok ? ((await res.json().catch(() => ({}))) as any) : null
}

function Action(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const Icon = props.icon
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      className={clsx(
        'inline-flex flex-none items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100',
        props.danger ? 'hover:text-rose-600' : 'hover:text-gray-900'
      )}
    >
      <Icon className="h-4 w-4" />
      {/* on a phone the icon alone, so names keep their room */}
      <span className="hidden sm:inline">{props.label}</span>
    </button>
  )
}

// Long lists show their first rows and a "Show all" at the end, so the section doesn't push the rest of the profile
// down.
const FIRST_ROWS = 5
function Group(props: {
  title: string
  count: number
  note?: React.ReactNode
  children: React.ReactNode[]
}) {
  const [all, setAll] = useState(false)
  const rows = props.children
  const hidden = rows.length - FIRST_ROWS
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-900">
          {props.title} <span className="font-normal text-gray-400">{props.count}</span>
        </h2>
        {props.note}
      </div>
      <ul className="divide-y divide-gray-100 rounded-md bg-white shadow">
        {all || hidden <= 1 ? rows : rows.slice(0, FIRST_ROWS)}
        {!all && hidden > 1 && (
          <li>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            >
              <ChevronDownIcon className="h-4 w-4" />
              Show all {rows.length}
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}

const rowClass = (gone: boolean) =>
  clsx(
    'flex min-h-[3.25rem] items-center gap-3 px-4 py-2',
    gone && 'bg-gray-50 [&>*:not(button)]:opacity-40'
  )

export function ProfileFollowing(props: {
  following: Following
  isOwnProfile: boolean
  firstName: string
}) {
  const { following, isOwnProfile, firstName } = props
  // Removed on this visit: kept on screen so a slip can be undone.
  const [gonePeople, setGonePeople] = useState<Set<string>>(new Set())
  const [goneProjects, setGoneProjects] = useState<Set<string>>(new Set())
  const [searches, setSearches] = useState<(SavedSearch & { gone?: boolean })[]>(
    following.searches ?? []
  )
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const { people, projects } = following
  const showSearches = following.searches !== null
  const nothing = people.length === 0 && projects.length === 0 && searches.length === 0
  if (nothing && !isOwnProfile) return null

  return (
    <section id="following" className="scroll-mt-6">
      <h1 className="mb-1 text-xl font-medium sm:text-2xl">Following</h1>
      <p className="mb-4 text-sm text-gray-500">
        {isOwnProfile ? (
          <>
            You hear about what these people do and how these projects go. Choose how often emails
            come on your{' '}
            <Link href="/notifications" className="text-orange-600 hover:underline">
              notifications page
            </Link>
            .
          </>
        ) : (
          `People and projects ${firstName} follows.`
        )}
      </p>
      {nothing ? (
        <p className="rounded-md bg-white p-4 text-sm text-gray-500 shadow">
          You don&apos;t follow anyone yet. Follow people from their profile, projects from their
          page, and searches from the home page.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {people.length > 0 && (
            <Group title="People" count={people.length - gonePeople.size}>
              {people.map((p) => {
                const gone = gonePeople.has(p.id)
                return (
                  <li key={p.id} className={rowClass(gone)}>
                    <Avatar username={p.username} avatarUrl={p.avatar_url} id={p.id} size="sm" />
                    <Link href={`/${p.username}`} className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium text-gray-900 hover:underline">
                        {p.full_name || p.username}
                      </span>{' '}
                      <span className="text-gray-400">@{p.username}</span>
                    </Link>
                    {isOwnProfile && (
                      <Action
                        icon={gone ? ArrowUturnLeftIcon : BookmarkSlashIcon}
                        label={gone ? 'Undo' : 'Unfollow'}
                        danger={!gone}
                        onClick={async () => {
                          if (
                            await send('/api/follows', gone ? 'POST' : 'DELETE', {
                              followedId: p.id,
                            })
                          )
                            setGonePeople((s) => toggle(s, p.id))
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </Group>
          )}
          {projects.length > 0 && (
            <Group title="Projects" count={projects.length - goneProjects.size}>
              {projects.map((p) => {
                const gone = goneProjects.has(p.id)
                return (
                  <li key={p.id} className={rowClass(gone)}>
                    <Link
                      href={`/projects/${p.slug}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 hover:underline"
                    >
                      {p.title}
                    </Link>
                    {isOwnProfile && (
                      <Action
                        icon={gone ? ArrowUturnLeftIcon : BookmarkSlashIcon}
                        label={gone ? 'Undo' : 'Unfollow'}
                        danger={!gone}
                        onClick={async () => {
                          // toggles: unfollows, or follows again on Undo
                          if (await send('/api/toggle-follow', 'POST', { projectId: p.id }))
                            setGoneProjects((s) => toggle(s, p.id))
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </Group>
          )}
          {showSearches && searches.length > 0 && (
            <Group
              title="Saved searches"
              count={searches.filter((s) => !s.gone).length}
              note={
                isOwnProfile && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <LockClosedIcon className="h-3.5 w-3.5" />
                    Only you see these
                  </span>
                )
              }
            >
              {searches.map((s) => (
                <li key={s.id} className={rowClass(!!s.gone)}>
                  <MagnifyingGlassIcon className="h-4 w-4 flex-none text-gray-400" />
                  <Link
                    href={`/?${s.query}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.paused_at && !s.gone && (
                    <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      Paused
                    </span>
                  )}
                  {isOwnProfile && !s.gone && (
                    <Action
                      icon={s.paused_at ? PlayIcon : PauseIcon}
                      label={s.paused_at ? 'Resume' : 'Pause'}
                      onClick={async () => {
                        const paused = !s.paused_at
                        if (await send('/api/saved-searches', 'PATCH', { id: s.id, paused }))
                          setSearches((all) =>
                            all.map((x) =>
                              x.id === s.id
                                ? { ...x, paused_at: paused ? new Date().toISOString() : null }
                                : x
                            )
                          )
                      }}
                    />
                  )}
                  {isOwnProfile && (
                    <Action
                      icon={s.gone ? ArrowUturnLeftIcon : TrashIcon}
                      label={s.gone ? 'Undo' : 'Remove'}
                      danger={!s.gone}
                      onClick={async () => {
                        if (!s.gone) {
                          if (await send('/api/saved-searches', 'DELETE', { id: s.id }))
                            setSearches((all) =>
                              all.map((x) => (x.id === s.id ? { ...x, gone: true } : x))
                            )
                          return
                        }
                        // Undo saves the same search again (a new row, unpaused)
                        const r = await send('/api/saved-searches', 'POST', { query: s.query })
                        if (r?.search)
                          setSearches((all) =>
                            all.map((x) => (x.id === s.id ? { ...r.search, paused_at: null } : x))
                          )
                      }}
                    />
                  )}
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
    </section>
  )
}
