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
import { HistoryPopup } from './comments/history-popup'
import { CommentActions } from './comments/comment-actions'
import { CommentEdit } from './comments/comment-edit'

export function Comment(props: {
  comment: Comment
  commenter: Profile
  commentHref: string
  rxns: CommentRxnWithProfile[]
  userId?: string
  userCharityBalance?: number
  writtenByCreator?: boolean
  contributionText?: string
  targetLabel?: string // where it was posted, shown in the header line in feeds and lists
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
    targetLabel,
    children,
    userProfile,
  } = props
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState<false | 'author' | 'moderator'>(false)
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
  if (comment.deleted_at) {
    // Every removal leaves a trace (transparency); the replies stay.
    return (
      <Col ref={commentElement} id={comment.id}>
        <Row className="w-full gap-2">
          <div className="ml-10 w-full rounded-xl rounded-tl-sm border border-dashed border-gray-300 px-4 py-2 text-sm italic text-gray-500">
            {comment.removed_reason
              ? `Removed by a moderator: ${comment.removed_reason}`
              : 'Deleted by the author'}
            <RelativeTime
              date={comment.deleted_at}
              className="ml-2 text-xs not-italic text-gray-400"
            />
          </div>
        </Row>
      </Col>
    )
  }
  return (
    <Col ref={commentElement} id={comment.id}>
      {contributionText && !targetLabel && (
        <div className="ml-10">
          <Tag text={contributionText} />
        </div>
      )}
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
            highlighted ? '!bg-orange-100 ring-2 !ring-orange-600' : '',
            editing && 'ring-1 ring-orange-300'
          )}
        >
          <Row className="mb-2 w-full items-center justify-between gap-2">
            <Row className="min-w-0 items-center gap-1">
              <UserLink
                name={commenter.full_name}
                username={commenter.username}
                creatorBadge={writtenByCreator}
                className="text-sm font-semibold"
              />
              <RelativeTime date={comment.created_at} className="min-w-fit text-xs text-gray-500" />
              {targetLabel && (
                <span className="truncate text-xs text-gray-500">
                  on{' '}
                  <Link href={commentHref} className="hover:text-gray-700 hover:underline">
                    {targetLabel}
                  </Link>
                </span>
              )}
              {comment.edited_at && <HistoryPopup comment={comment} />}
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
          {editing ? (
            <CommentEdit
              comment={comment}
              asModerator={editing === 'moderator'}
              onDone={() => setEditing(false)}
            />
          ) : (
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
          )}
          {!editing && (
            <Row className="mt-1 justify-between gap-2">
              <CommentRxnsPanel
                commentId={comment.id}
                userId={userId}
                // No tips on your own comment (C35): the tipped reactions aren't offered there.
                userCharityBalance={userId === comment.commenter ? undefined : userCharityBalance}
                rxns={rxns}
                orangeBg={highlighted}
                userProfile={userProfile}
              />
              <Row className="mt-1.5 items-center gap-3">
                <CommentActions
                  comment={comment}
                  viewerId={userId}
                  onEdit={(asModerator) => setEditing(asModerator ? 'moderator' : 'author')}
                />
                {children}
              </Row>
            </Row>
          )}
        </Card>
      </Row>
    </Col>
  )
}
