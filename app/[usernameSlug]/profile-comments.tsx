import { Col } from '@/components/layout/col'
import { commentHref, isListed, targetTitle } from '@/lib/comments/links'
import { CommentAndProjectAndRxns } from '@/db/comment'
import { Profile } from '@/db/profile'
import { orderBy } from 'es-toolkit'
import { Comment } from '@/components/comment'

export function ProfileComments(props: {
  comments: CommentAndProjectAndRxns[]
  profile: Profile
  userId?: string
  userCharityBalance?: number
  userProfile?: Profile
}) {
  const { comments, profile, userId, userCharityBalance, userProfile } = props
  const filteredComments = comments.filter(isListed)
  const sortedComments = orderBy(filteredComments, ['created_at'], ['desc'])
  return (
    <div>
      <h1 className="mb-2 text-xl font-medium sm:text-2xl">
        Comments {profile.full_name || profile.username} wrote
      </h1>
      <Col className="gap-8">
        {sortedComments.map((comment) => {
          return (
            <Comment
              key={comment.id}
              comment={comment}
              commenter={profile}
              userId={userId}
              userCharityBalance={userCharityBalance}
              rxns={comment.comment_rxns}
              commentHref={commentHref(comment)}
              targetLabel={targetTitle(comment)}
              userProfile={userProfile}
            />
          )
        })}
      </Col>
    </div>
  )
}
