'use client'
import { useSearchParams } from 'next/navigation'
import { Tabs } from '@/components/tabs'
import { CommentsSection } from '@/components/comments/comments-section'
import type { CommentAndProfileAndRxns, CommentAndProjectAndRxns } from '@/db/comment'
import type { Profile } from '@/db/profile'
import { isListed } from '@/lib/comments/links'
import { ProfileComments } from './profile-comments'
import { ProfileFollowing, followingCount } from './profile-following'
import type { Following } from '@/db/profile-follows'

// The tabs of a profile: what people say about this person (C8), what they wrote elsewhere (C30), and what
// they follow (F9). Their replies on their own profile stay in the first tab, in
// their threads, and aren't repeated in the second. Others see the Following tab only when it isn't empty.
export function ProfileCommentTabs(props: {
  profile: Profile
  profileComments: CommentAndProfileAndRxns[]
  comments: CommentAndProjectAndRxns[]
  userProfile?: Profile
  userCharityBalance: number
  following: Following
}) {
  const { profile, profileComments, comments, userProfile, userCharityBalance, following } = props
  const isOwnProfile = userProfile?.id === profile.id
  const firstName = (profile.full_name || profile.username).split(' ')[0]
  const searchParams = useSearchParams()
  const written = comments.filter((c) => isListed(c) && c.profile_id !== profile.id)
  const tabs = [
    {
      name: `About ${firstName}`,
      id: 'about',
      count: profileComments.length,
      display: (
        <section id="comments-on-profile">
          <CommentsSection
            target={{ profile_id: profile.id }}
            basePath={`/${profile.username}`}
            comments={profileComments}
            userProfile={userProfile}
            userCharityBalance={userCharityBalance}
            canStartThread={!isOwnProfile}
            placeholder={`What’s it like to work with ${firstName}? Share your experience as a grantee, collaborator, or colleague. Please don’t use this to pitch projects or ask for funding.`}
            emptyText="No comments yet."
          />
        </section>
      ),
    },
    {
      name: `By ${firstName}`,
      id: 'by',
      count: written.length,
      display:
        written.length > 0 ? (
          <ProfileComments
            comments={written}
            profile={profile}
            userCharityBalance={userCharityBalance}
            userId={userProfile?.id}
            userProfile={userProfile}
          />
        ) : (
          <p className="text-center text-sm text-gray-500">Nothing yet.</p>
        ),
    },
  ]
  const followed = followingCount(following)
  if (followed > 0 || isOwnProfile)
    tabs.push({
      name: 'Following',
      id: 'following',
      count: followed,
      display: (
        <ProfileFollowing following={following} isOwnProfile={isOwnProfile} firstName={firstName} />
      ),
    })
  return <Tabs tabs={tabs} currentTabId={searchParams?.get('tab')} />
}
