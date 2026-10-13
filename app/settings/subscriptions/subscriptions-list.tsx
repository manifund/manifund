'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/avatar'

type Person = {
  followed_id: string
  followed: { id: string; username: string; full_name: string | null; avatar_url: string | null }
}
type Search = { id: string; name: string; query: string; paused_at: string | null }
type Project = { project_id: string; projects: { title: string; slug: string } }

async function send(url: string, method: string, body: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

function Section(props: {
  title: string
  empty: string
  children: React.ReactNode
  count: number
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium text-gray-900">{props.title}</h2>
      {props.count === 0 ? (
        <p className="text-sm text-gray-500">{props.empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          {props.children}
        </ul>
      )}
    </section>
  )
}

export function SubscriptionsList(props: {
  people: Person[]
  searches: Search[]
  projects: Project[]
}) {
  const [people, setPeople] = useState(props.people)
  const [searches, setSearches] = useState(props.searches)
  const [projects, setProjects] = useState(props.projects)
  return (
    <div>
      <Section
        title="People"
        empty="You don't follow anyone yet. Follow someone from their profile."
        count={people.length}
      >
        {people.map((p) => (
          <li key={p.followed_id} className="flex items-center gap-3 p-3">
            <Avatar
              username={p.followed.username}
              avatarUrl={p.followed.avatar_url}
              id={p.followed.id}
              size="sm"
            />
            <Link
              href={`/${p.followed.username}`}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            >
              {p.followed.full_name || p.followed.username}
            </Link>
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-red-600 hover:underline"
              onClick={async () => {
                if (await send('/api/follows', 'DELETE', { followedId: p.followed_id }))
                  setPeople((all) => all.filter((x) => x.followed_id !== p.followed_id))
              }}
            >
              Unfollow
            </button>
          </li>
        ))}
      </Section>
      <Section
        title="Saved searches"
        empty="No saved searches. Filter the projects on the home page, then choose “Notify me about new projects like this”."
        count={searches.length}
      >
        {searches.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
            <Link
              href={`/?${s.query}`}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            >
              {s.name}
            </Link>
            {s.paused_at && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                Paused
              </span>
            )}
            <button
              type="button"
              className="text-sm text-gray-600 hover:underline"
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
            >
              {s.paused_at ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-red-600 hover:underline"
              onClick={async () => {
                if (await send('/api/saved-searches', 'DELETE', { id: s.id }))
                  setSearches((all) => all.filter((x) => x.id !== s.id))
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </Section>
      <Section title="Projects" empty="You don't follow any projects." count={projects.length}>
        {projects.map((p) => (
          <li key={p.project_id} className="flex items-center gap-3 p-3">
            <Link
              href={`/projects/${p.projects.slug}`}
              className="min-w-0 flex-1 truncate text-sm hover:underline"
            >
              {p.projects.title}
            </Link>
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-red-600 hover:underline"
              onClick={async () => {
                if (await send('/api/toggle-follow', 'POST', { projectId: p.project_id }))
                  setProjects((all) => all.filter((x) => x.project_id !== p.project_id))
              }}
            >
              Unfollow
            </button>
          </li>
        ))}
      </Section>
    </div>
  )
}
