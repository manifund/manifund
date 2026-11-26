'use client'
import { Comment } from '@/components/comment'
import { CommentAndProjectAndRxns } from '@/db/comment'
import { Profile } from '@/db/profile'
import { commentHref, targetTitle } from '@/lib/comments/links'
import { loadMoreComments } from '../actions'
import { ShowMore, usePaged } from '../show-more'
import type { Page } from '../profile-data'

export function CommentList(props: {
  profile: Profile
  first: Page<CommentAndProjectAndRxns>
  total: number
  userProfile?: Profile
  userCharityBalance: number
}) {
  const { profile, first, total, userProfile, userCharityBalance } = props
  const { items, hasMore, more, pending, error } = usePaged(first, (offset) =>
    loadMoreComments(profile.id, offset)
  )
  return (
    <>
      <div className="flex flex-col gap-6 font-normal">
        {items.map((comment) => (
          <Comment
            key={comment.id}
            comment={comment}
            commenter={profile}
            userId={userProfile?.id}
            userCharityBalance={userCharityBalance}
            rxns={comment.comment_rxns}
            commentHref={commentHref(comment)}
            targetLabel={targetTitle(comment)}
            userProfile={userProfile}
          />
        ))}
      </div>
      {hasMore && (
        <ShowMore
          shown={items.length}
          total={total}
          onClick={more}
          pending={pending}
          error={error}
        />
      )}
    </>
  )
}
