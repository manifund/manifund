'use client'
import { useSearchParams } from 'next/navigation'
import { Tabs } from '@/components/tabs'
import { CommentsSection } from '@/components/comments/comments-section'
import type { CommentAndProfileAndRxns, CommentAndProjectAndRxns } from '@/db/comment'
import type { Profile } from '@/db/profile'
import { isListed } from '@/lib/comments/links'
import { ProfileComments } from './profile-comments'

// The comments part of a profile: what people say about this person (C8), and what they wrote
// elsewhere (C30), as two tabs rather than two headed sections. Their replies on their own profile
// stay in the first tab, in their threads, and aren't repeated in the second.
export function ProfileCommentTabs(props: {
  profile: Profile
  profileComments: CommentAndProfileAndRxns[]
  comments: CommentAndProjectAndRxns[]
  userProfile?: Profile
  userCharityBalance: number
}) {
  const { profile, profileComments, comments, userProfile, userCharityBalance } = props
  const isOwnProfile = userProfile?.id === profile.id
  const firstName = (profile.full_name || profile.username).split(' ')[0]
  const searchParams = useSearchParams()
  const written = comments.filter((c) => isListed(c) && c.profile_id !== profile.id)
  const tabs = [
    {
      name: 'Comments',
      id: 'comments',
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
            placeholder={`What is it like to work with ${firstName}?`}
            emptyText="No comments yet."
          />
        </section>
      ),
    },
    {
      name: 'Their comments',
      id: 'their-comments',
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
  return <Tabs tabs={tabs} currentTabId={searchParams?.get('tab')} />
}
