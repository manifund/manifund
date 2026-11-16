'use client'
import { useSearchParams } from 'next/navigation'
import { Tabs } from '@/components/tabs'
import type { CommentAndProjectAndRxns } from '@/db/comment'
import type { Profile } from '@/db/profile'
import { isListed } from '@/lib/comments/links'
import { ProfileComments } from './profile-comments'
import { ProfileFollowing, followingCount } from './profile-following'
import type { Following } from '@/db/profile-follows'

// The tabs of a profile: what this person wrote (C30) and what they follow (F9). Comments on
// profiles (C8) aren't shown, here or in the list. Others see the Following tab only when it isn't empty.
export function ProfileCommentTabs(props: {
  profile: Profile
  comments: CommentAndProjectAndRxns[]
  userProfile?: Profile
  userCharityBalance: number
  following: Following
}) {
  const { profile, comments, userProfile, userCharityBalance, following } = props
  const isOwnProfile = userProfile?.id === profile.id
  const firstName = (profile.full_name || profile.username).split(' ')[0]
  const searchParams = useSearchParams()
  const written = comments.filter((c) => isListed(c) && !c.profile_id)
  const tabs = [
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
