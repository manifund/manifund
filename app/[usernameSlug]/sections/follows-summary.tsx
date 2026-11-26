'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { Avatar } from '@/components/avatar'
import type { Following } from '@/db/profile-follows'
import { ProfileFollowing, followingCount } from '../profile-following'

const PEOPLE_SHOWN = 14
const PROJECTS_SHOWN = 6

// What someone follows (F9), in their About: faces for people, titles for projects, chips for saved
// searches. On your own profile, "Manage" opens the full lists with unfollow and remove.
export function FollowsSummary(props: {
  following: Following
  isOwnProfile: boolean
  firstName: string
}) {
  const { following, isOwnProfile, firstName } = props
  const [managing, setManaging] = useState(false)
  const { people, projects, searches } = following
  if (followingCount(following) === 0 && !isOwnProfile) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-normal tracking-tight text-gray-900">
          {isOwnProfile ? 'What you follow' : `What ${firstName} follows`}
        </h3>
        {isOwnProfile && followingCount(following) > 0 && (
          <button
            type="button"
            onClick={() => setManaging(!managing)}
            aria-expanded={managing}
            className="flex items-center gap-1 text-[13px] text-orange-600 hover:underline"
          >
            {managing ? 'Done' : 'Manage'}
            <ChevronDownIcon
              className={clsx('h-4 w-4 transition-transform', managing && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {managing || followingCount(following) === 0 ? (
        <ProfileFollowing following={following} isOwnProfile={isOwnProfile} firstName={firstName} />
      ) : (
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-4 rounded-lg bg-white p-5 text-sm shadow-sm">
          {people.length > 0 && (
            <>
              <dt className="pt-1.5 text-gray-500">
                {people.length} {people.length === 1 ? 'person' : 'people'}
              </dt>
              <dd className="flex flex-wrap items-center gap-1.5">
                {people.slice(0, PEOPLE_SHOWN).map((person) => (
                  <Link
                    key={person.id}
                    href={`/${person.username}`}
                    title={person.full_name || person.username}
                    className="rounded-full ring-2 ring-white focus:outline-none focus-visible:ring-orange-500"
                  >
                    <Avatar
                      username={person.username}
                      avatarUrl={person.avatar_url}
                      id={person.id}
                      size={8}
                      noLink
                    />
                    <span className="sr-only">{person.full_name || person.username}</span>
                  </Link>
                ))}
                {people.length > PEOPLE_SHOWN && (
                  <span className="pl-1 text-[13px] text-gray-500">
                    and {people.length - PEOPLE_SHOWN} more
                  </span>
                )}
              </dd>
            </>
          )}
          {projects.length > 0 && (
            <>
              <dt className="text-gray-500">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </dt>
              <dd>
                <ul className="flex flex-col gap-1.5">
                  {projects.slice(0, PROJECTS_SHOWN).map((project) => (
                    <li key={project.id} className="truncate">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="text-gray-900 hover:text-orange-700 hover:underline"
                      >
                        {project.title}
                      </Link>
                    </li>
                  ))}
                  {projects.length > PROJECTS_SHOWN && (
                    <li className="text-[13px] text-gray-500">
                      and {projects.length - PROJECTS_SHOWN} more
                    </li>
                  )}
                </ul>
              </dd>
            </>
          )}
          {searches.length > 0 && (
            <>
              <dt className="pt-0.5 text-gray-500">
                {searches.length} {searches.length === 1 ? 'search' : 'searches'}
              </dt>
              <dd className="flex flex-wrap gap-2">
                {searches.map((search) => (
                  <Link
                    key={search.id}
                    href={`/?${search.query}`}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[13px] text-gray-700 hover:bg-orange-50 hover:text-orange-800"
                  >
                    <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                    {search.name}
                  </Link>
                ))}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
