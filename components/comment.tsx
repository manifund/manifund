import { UserLink } from '@/components/user-link'
import { RelativeTime } from '@/components/relative-time'
import { RichContent } from '@/components/editor'
import { Row } from '@/components/layout/row'
import { Col } from '@/components/layout/col'
import { Tag } from '@/components/tags'
import { type Comment, type CommentRxnWithProfile } from '@/db/comment'
import { type Profile } from '@/db/profile'
import Link from 'next/link'
import clsx from 'clsx'
import { Card } from './layout/card'
import { Avatar } from './avatar'
import { useRef, useState } from 'react'
import { LinkIcon } from '@heroicons/react/20/solid'
import { Tooltip } from './tooltip'
import { useSafeLayoutEffect } from '@/hooks/use-safe-layout-effect'
import { toSentenceCase } from '@/utils/formatting'
import { CommentRxnsPanel } from './comment-rxn'

export function Comment(props: {
  comment: Comment
  commenter: Profile
  commentHref: string
  rxns: CommentRxnWithProfile[]
  userId?: string
  userCharityBalance?: number
  writtenByCreator?: boolean
  contributionText?: string
  projectTitle?: string
  children?: React.ReactNode
  userProfile?: Profile
}) {
  const {
    comment,
    commenter,
    rxns,
    userId,
    userCharityBalance,
    commentHref,
    writtenByCreator,
    contributionText,
    projectTitle,
    children,
    userProfile,
  } = props
  const [expanded, setExpanded] = useState(false)
  const [showExpandButton, setShowExpandButton] = useState(false)
  const contentElement = useRef<any>(null)
  useSafeLayoutEffect(() => {
    if (contentElement.current && contentElement.current.scrollHeight > 500) {
      setShowExpandButton(true)
    }
  }, [contentElement])
  const commentElement = useRef<any>(null)
  const [highlighted, setHighlighted] = useState(false)
  useSafeLayoutEffect(() => {
    if (window.location.hash === `#${comment.id}`) {
      setHighlighted(true)
      commentElement.current.scrollIntoView({ behavior: 'smooth' })
    } else {
      setHighlighted(false)
    }
  }, [])
  return (
    <Col ref={commentElement} id={comment.id}>
      <div className="ml-10">
        {projectTitle && (
          <Link href={`${commentHref}`}>
            <Tag text={projectTitle} className="hover:bg-orange-200" />
          </Link>
        )}
        {contributionText && !projectTitle && <Tag text={contributionText} />}
      </div>
      <Row className="w-full gap-2">
        <Link href={`/${commenter.username}`}>
          <Avatar
            username={commenter.username}
            avatarUrl={commenter.avatar_url}
            id={commenter.id}
            className="mt-1"
            size="sm"
            noLink
          />
        </Link>
        <Card
          className={clsx(
            'relative w-full overflow-visible rounded-xl rounded-tl-sm px-4 py-2',
            highlighted ? '!bg-orange-100 ring-2 !ring-orange-600' : ''
          )}
        >
          <Row className="mb-2 w-full items-center justify-between gap-2">
            <Row className="min-w-fit items-center gap-1">
              <UserLink
                name={commenter.full_name}
                username={commenter.username}
                creatorBadge={writtenByCreator}
                className="text-sm font-semibold"
              />
              <RelativeTime
                date={comment.created_at}
                className="min-w-fit text-xs text-gray-500"
              />
              <Tooltip text="Copy link to comment" className="cursor-pointer">
                <LinkIcon
                  className="h-3 w-3 stroke-2 text-gray-500 hover:text-gray-700"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}${commentHref}`)
                  }}
                />
              </Tooltip>
            </Row>
            {comment.special_type && (
              <Tag text={toSentenceCase(comment.special_type)} className="text-xs" color="blue" />
            )}
          </Row>
          <div className={clsx('relative', showExpandButton && 'pb-5')}>
            <div
              id="content"
              ref={contentElement}
              className={clsx(expanded || !showExpandButton ? 'max-h-fit' : 'line-clamp-[12]')}
            >
              <RichContent content={comment.content} className="text-sm" />
            </div>
            {showExpandButton && (
              <div
                className={clsx(
                  'absolute bottom-0 left-0 flex w-full flex-col justify-end',
                  expanded ? 'h-2' : 'h-32',
                  !expanded
                    ? highlighted
                      ? 'shadow-[inset_0px_-100px_50px_-50px_rgba(255,237,213,0.9)]'
                      : 'shadow-[inset_0px_-100px_50px_-50px_rgba(255,255,255,0.9)]'
                    : ''
                )}
              >
                <button
                  className="text-xs text-gray-500 hover:underline"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}
          </div>
          <Row className="mt-1 justify-between gap-2">
            <CommentRxnsPanel
              commentId={comment.id}
              userId={userId}
              userCharityBalance={userCharityBalance}
              rxns={rxns}
              orangeBg={highlighted}
              userProfile={userProfile}
            />
            <div className="mt-1.5">{children}</div>
          </Row>
        </Card>
      </Row>
    </Col>
  )
}
