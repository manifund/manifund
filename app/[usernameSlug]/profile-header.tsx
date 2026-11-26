'use client'
import { ReactNode } from 'react'
import Link from 'next/link'
import { GiftIcon, PencilIcon } from '@heroicons/react/20/solid'
import { Avatar } from '@/components/avatar'
import { Database } from '@/db/database.types'
import { RegranterTag } from '@/components/tags'
import { Karma } from '@/components/karma'
import { addHttpToUrl } from '@/utils/formatting'
import { buttonClass } from '@/components/button'
import { SignOutButton } from './sign-out-button'

type Profile = Database['public']['Tables']['profiles']['Row']

const hostname = (url: string) =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')

// The top of a profile (E12): who they are, in the same shape as an org's or a fund's page. `actions` (follow,
// admin tools) and `giving` stream in after it; the header itself needs only the profile.
export function ProfileHeader(props: {
  profile: Profile
  isOwnProfile: boolean
  email?: string
  donorPage?: boolean
  actions?: ReactNode
  links?: ReactNode
  giving?: ReactNode
}) {
  const { profile, isOwnProfile, email, donorPage, actions, links, giving } = props
  const website = profile.website ? addHttpToUrl(profile.website) : null
  return (
    <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
      <Avatar
        username={profile.username}
        avatarUrl={profile.avatar_url}
        id={profile.id}
        noLink
        size={22}
        className="shadow-sm ring-4 ring-white"
      />
      <div className="min-w-0 flex-[1_1_420px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[34px] font-medium leading-tight tracking-tight text-gray-900">
              {profile.full_name || profile.username}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-gray-500">
              <span>@{profile.username}</span>
              {profile.regranter_status && <RegranterTag />}
              <Karma
                value={profile.karma}
                breakdown={profile.karma_breakdown}
                kind="profile"
                size="md"
                placement="right-start"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {isOwnProfile && (
              <>
                <Link href="/edit-profile" className={buttonClass('xs', 'light-orange')}>
                  <PencilIcon className="mr-1 h-4 w-4" aria-hidden />
                  Edit profile
                </Link>
                <SignOutButton />
              </>
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="mt-3 text-pretty text-lg leading-normal text-gray-700">{profile.bio}</p>
        )}
        {(website || donorPage || links || (isOwnProfile && email)) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-gray-500">
            {website && profile.website && (
              <a href={website} className="text-orange-600 hover:underline">
                {hostname(profile.website)} ↗
              </a>
            )}
            {donorPage && (
              <Link
                href={`/${profile.username}/donor`}
                className="inline-flex items-center gap-1 text-orange-600 hover:underline"
              >
                <GiftIcon className="h-3.5 w-3.5" aria-hidden />
                Donor survey answers
              </Link>
            )}
            {links}
            {/* Only on your own profile (E14) */}
            {isOwnProfile && email && <span>{email}</span>}
          </div>
        )}
        {giving}
      </div>
    </header>
  )
}
