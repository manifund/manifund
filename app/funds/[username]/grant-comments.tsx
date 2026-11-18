'use client'
import Link from 'next/link'
import { Comment } from '@/components/comment'
import { formatMoneyShort } from '@/utils/formatting'
import type { FullProject } from '@/db/project'
import type { CommentAndProfileAndRxns } from '@/db/comment'
import type { Profile } from '@/db/profile'
import type { GrantAmount } from './grant-cards'

export type GrantComment = { comment: CommentAndProfileAndRxns; href: string }

// A grant with its admin's comment (F11) shows as that comment, in full, tagged with the grant:
// "$10k to Samuel Ratnam for Mindscapes". The tag and the link below go to the comment on the project.
export function GrantComments(props: {
  projects: FullProject[]
  amounts: Record<string, GrantAmount>
  comments: Record<string, GrantComment>
  userId?: string
  userProfile?: Profile
  userCharityBalance?: number
}) {
  const { projects, amounts, comments, userId, userProfile, userCharityBalance } = props
  return (
    <div className="flex flex-col gap-8 font-normal">
      {projects.map((project) => {
        const { granted, offered } = amounts[project.id]
        const { comment, href } = comments[project.id]
        const recipient = project.profiles?.full_name || project.profiles?.username
        const amount = formatMoneyShort(granted + offered)
        const label = `${granted > 0 ? amount : `${amount} offered`} to ${recipient} for ${project.title}`
        return (
          <Comment
            key={project.id}
            comment={comment}
            commenter={comment.profiles}
            rxns={comment.comment_rxns}
            commentHref={href}
            targetLabel={label}
            fullText
            userId={userId}
            userProfile={userProfile}
            userCharityBalance={userCharityBalance}
          >
            <Link href={href} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
              View on project
            </Link>
          </Comment>
        )
      })}
    </div>
  )
}
