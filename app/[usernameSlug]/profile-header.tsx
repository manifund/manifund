'use client'
import { Avatar } from '@/components/avatar'
import { PencilIcon, LinkIcon, GiftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { Database } from '@/db/database.types'
import { RegranterTag } from '@/components/tags'
import { Karma } from '@/components/karma'
import { addHttpToUrl } from '@/utils/formatting'
import { Row } from '@/components/layout/row'
import { Col } from '@/components/layout/col'
import { SignOutButton } from './sign-out-button'
import { SuperBanButton } from './superban-dialog'
import { FullProject } from '@/db/project'
import { CommentAndProjectAndRxns } from '@/db/comment'

type Profile = Database['public']['Tables']['profiles']['Row']

export function ProfileHeader(props: {
  profile: Profile
  isOwnProfile: boolean
  email?: string
  isAdmin?: boolean
  projects?: FullProject[]
  comments?: CommentAndProjectAndRxns[]
  donorPage?: boolean
}) {
  const { profile, isOwnProfile, email, isAdmin, projects, comments, donorPage } = props
  const website = addHttpToUrl(profile.website ?? '')
  return (
    <div className="flex flex-col gap-3">
      <Row className="w-full items-start justify-between">
        <Row>
          <Avatar
            username={profile.username}
            avatarUrl={profile.avatar_url}
            id={profile.id}
            noLink
            className="hidden sm:block"
            size={24}
          />
          <Avatar
            username={profile.username}
            avatarUrl={profile.avatar_url}
            id={profile.id}
            noLink
            size={12}
            className="sm:hidden"
          />
          {isOwnProfile && (
            <div className="relative right-4 top-8 h-5 w-5 rounded-full bg-orange-500 hover:bg-orange-600 sm:right-6 sm:top-14 sm:h-10 sm:w-10">
              <Link href="/edit-profile">
                <PencilIcon className="h-5 w-5 p-1 text-white sm:h-10 sm:w-10 sm:p-2" aria-hidden />
              </Link>
            </div>
          )}
          <Col className="ml-2 w-full">
            <Row className="justify-between">
              <Col>
                <div className="text-xl font-bold leading-none sm:text-2xl">
                  {profile.full_name}
                </div>
                <Row className="mt-1 flex-wrap items-center gap-2 text-gray-500">
                  <p>@{profile.username}</p>
                  {profile.regranter_status && <RegranterTag />}
                </Row>
                <Karma
                  value={profile.karma}
                  breakdown={profile.karma_breakdown}
                  kind="profile"
                  size="md"
                  placement="right-start"
                  className="mt-1 self-start"
                />
                {isOwnProfile && (
                  <Row className="mt-1 flex-wrap items-center gap-2 text-gray-400">
                    <p>{email}</p>
                  </Row>
                )}
              </Col>
            </Row>
          </Col>
        </Row>
        <Row className="gap-2">
          {isAdmin && !isOwnProfile && projects && comments && (
            <SuperBanButton profile={profile} projects={projects} comments={comments} />
          )}
          {isOwnProfile && <SignOutButton />}
        </Row>
      </Row>
      <div>
        <p>{profile.bio}</p>
        {profile.website && (
          <a
            className="flex gap-1 text-gray-500 hover:cursor-pointer hover:underline"
            href={website}
          >
            <LinkIcon className="relative top-1 h-4 w-4" strokeWidth={2.5} />
            {profile.website}
          </a>
        )}
        {donorPage && (
          <Link
            className="flex gap-1 text-gray-500 hover:cursor-pointer hover:underline"
            href={`/${profile.username}/donor`}
          >
            <GiftIcon className="relative top-1 h-4 w-4" strokeWidth={2.5} />
            Donor survey answers
          </Link>
        )}
      </div>
    </div>
  )
}
