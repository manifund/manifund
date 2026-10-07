'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { CommentRxnsPanel } from '@/components/comment-rxn'
import { CommentActions } from '@/components/comments/comment-actions'
import { CommentEdit } from '@/components/comments/comment-edit'
import { WriteComment } from '@/components/comments/comments-section'
import { HistoryPopup } from '@/components/comments/history-popup'
import { RichContent } from '@/components/editor'
import { UserLink } from '@/components/user-link'
import type { CommentAndProfileAndRxns } from '@/db/comment'
import type { ExternalReview, Org } from '@/db/org'
import type { Profile } from '@/db/profile'
import { useSafeLayoutEffect } from '@/hooks/use-safe-layout-effect'
import { ASSUMED_RATING } from '../rating'
import { manifundUsername, splitManifundReview } from './manifund-reviews'

const STARS = '★'.repeat(ASSUMED_RATING)

// Who a review comes from, for the filter chips. Nothing says yet who is staff; reviews published
// elsewhere are peers'.
type Kind = 'donor' | 'staff' | 'peer' | 'other'
const FILTERS: { id: Kind | 'all'; label: string; empty: string }[] = [
  { id: 'all', label: 'All', empty: 'No reviews yet.' },
  { id: 'donor', label: 'Donors', empty: 'No reviews from donors yet.' },
  { id: 'staff', label: 'Staff', empty: 'No reviews from staff yet.' },
  { id: 'peer', label: 'Peers', empty: 'No reviews from peers yet.' },
]

type Item =
  | {
      kind: Kind
      date: string
      comment: CommentAndProfileAndRxns
      replies: CommentAndProfileAndRxns[]
    }
  | { kind: Kind; date: string; review: ExternalReview }

const monthYear = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', timeZone: 'UTC' })

const hostname = (url: string) =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')

export function Reviews(props: {
  org: Org
  comments: CommentAndProfileAndRxns[]
  externalReviews: ExternalReview[]
  commenterTags: Record<string, string> // "gave $500", for reviewers who donated
  // Manifund profiles of people whose reviews Trace collected from project comments, by username.
  reviewers: Record<string, { regrantor: boolean; tag?: string }>
  userProfile?: Profile
  userCharityBalance: number
}) {
  const {
    org,
    comments,
    externalReviews,
    commenterTags,
    reviewers,
    userProfile,
    userCharityBalance,
  } = props
  const [filter, setFilter] = useState<Kind | 'all'>('all')

  const items: Item[] = [
    ...comments
      .filter((comment) => !comment.replying_to)
      .map((comment) => ({
        kind: (commenterTags[comment.commenter] ? 'donor' : 'other') as Kind,
        date: comment.created_at,
        comment,
        replies: comments
          .filter((reply) => reply.replying_to === comment.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })),
    ...externalReviews.map((review) => {
      // Written on Manifund (a project comment Trace collected): one of the community's, not a peer's.
      const username = manifundUsername(review.reviewerUrl)
      const kind: Kind = !username ? 'peer' : reviewers[username]?.tag ? 'donor' : 'other'
      return { kind, date: review.reviewedAt, review }
    }),
  ].sort((a, b) => b.date.localeCompare(a.date))
  // A removed review keeps its place in the list but isn't counted.
  const count = items.filter((item) => !('comment' in item && item.comment.deleted_at)).length
  const shown = items.filter((item) => filter === 'all' || item.kind === filter)

  return (
    <>
      <div>
        <h2 className="text-2xl font-normal tracking-tight text-gray-900">Reviews</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Star ratings not yet implemented; all default to 5 stars
        </p>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-8 border-b border-gray-100 pb-5">
          <div>
            <div className="text-[40px] font-normal leading-none text-gray-900">
              {count > 0 ? ASSUMED_RATING.toFixed(1) : '–'}
            </div>
            <div
              className={clsx(
                'mt-1 tracking-[2px]',
                count > 0 ? 'text-orange-500' : 'text-gray-300'
              )}
            >
              {STARS}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {count} review{count === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex max-w-[360px] flex-[1_1_240px] flex-col gap-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = star === ASSUMED_RATING ? count : 0
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2.5">{star}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full bg-orange-400" style={{ width: n > 0 ? '100%' : 0 }} />
                  </div>
                  <span className="w-[18px] text-right tabular-nums">{n}</span>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  'rounded-full border px-3 py-1 text-[13px] transition-colors',
                  filter === f.id
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0">
          {shown.map((item) =>
            'comment' in item ? (
              <CommunityReview
                key={item.comment.id}
                org={org}
                comment={item.comment}
                replies={item.replies}
                tag={commenterTags[item.comment.commenter]}
                userProfile={userProfile}
                userCharityBalance={userCharityBalance}
              />
            ) : (
              <PublishedReview
                key={item.review.id}
                review={item.review}
                reviewer={reviewers[manifundUsername(item.review.reviewerUrl) ?? '']}
              />
            )
          )}
          {shown.length === 0 && (
            <p className="border-b border-gray-100 py-8 text-center text-sm text-gray-500">
              {FILTERS.find((f) => f.id === filter)?.empty}
            </p>
          )}
        </div>
      </div>

      {/* Outside the card: the comment box is a white card itself. */}
      {userProfile ? (
        <WriteComment
          target={{ org_id: org.id }}
          commenter={userProfile}
          placeholder={`What should donors know about ${org.name}?`}
        />
      ) : (
        <p className="text-center text-sm text-gray-500">
          <Link href={`/login?next=/orgs/${org.slug}`} className="text-orange-600 hover:underline">
            Sign in
          </Link>{' '}
          to write a review.
        </p>
      )}
    </>
  )
}

function ReviewHeader(props: {
  name: React.ReactNode
  role?: React.ReactNode
  badge?: string
  date: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-[13px] tracking-[1px] text-orange-500">{STARS}</span>
      <span className="text-sm font-normal text-gray-900">{props.name}</span>
      {props.role && <span className="text-[13px] text-gray-500">· {props.role}</span>}
      {props.badge && (
        <span className="rounded bg-gray-100 px-1.5 py-px text-[11px] text-gray-600">
          {props.badge}
        </span>
      )}
      {props.children}
      <span className="flex-1" />
      <span className="text-xs text-gray-400">{monthYear(props.date)}</span>
    </div>
  )
}

// A review written here: a comment on the org, with everything comments have (reactions, replies,
// editing, reports), laid out as a review.
function CommunityReview(props: {
  org: Org
  comment: CommentAndProfileAndRxns
  replies: CommentAndProfileAndRxns[]
  tag?: string
  userProfile?: Profile
  userCharityBalance: number
}) {
  const { org, comment, replies, tag, userProfile, userCharityBalance } = props
  const [replying, setReplying] = useState(false)
  const [highlighted, setHighlighted] = useState(false)
  const element = useRef<HTMLElement>(null)
  useSafeLayoutEffect(() => {
    if (window.location.hash === `#${comment.id}`) {
      setHighlighted(true)
      element.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])
  const helpful = new Set(comment.comment_rxns.map((rxn) => rxn.reactor_id)).size

  if (comment.deleted_at) {
    return (
      <article className="border-b border-gray-100 py-5 text-sm italic text-gray-500">
        {comment.removed_reason
          ? `Removed by a moderator: ${comment.removed_reason}`
          : 'Deleted by the author'}
      </article>
    )
  }
  return (
    <article
      id={comment.id}
      ref={element}
      className={clsx(
        'flex scroll-mt-24 flex-col gap-1.5 border-b border-gray-100 py-5',
        highlighted && '-mx-3 rounded-md bg-orange-50 px-3'
      )}
    >
      <ReviewHeader
        name={
          <UserLink
            name={comment.profiles.full_name}
            username={comment.profiles.username}
            hideBadge
          />
        }
        role={comment.profiles.regranter_status ? 'Regrantor' : undefined}
        badge={tag ? tag.replace(/^gave/, 'Donated') : undefined}
        date={comment.created_at}
      >
        {comment.edited_at && <HistoryPopup comment={comment} />}
      </ReviewHeader>
      <ReviewBody comment={comment} userProfile={userProfile} />
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        {helpful > 0 && <span>{helpful} found this helpful</span>}
        <CommentRxnsPanel
          commentId={comment.id}
          userId={userProfile?.id}
          // No tips on your own comment (C35).
          userCharityBalance={
            userProfile?.id === comment.commenter ? undefined : userCharityBalance
          }
          rxns={comment.comment_rxns}
          userProfile={userProfile}
        />
        {userProfile && (
          <button
            type="button"
            className="hover:text-gray-700 hover:underline"
            onClick={() => setReplying(!replying)}
          >
            Reply
          </button>
        )}
      </div>
      {replies.length > 0 && (
        <div className="mt-2 flex flex-col gap-3 border-l-2 border-gray-100 pl-4">
          {replies
            .filter((reply) => !reply.deleted_at)
            .map((reply) => (
              <div key={reply.id} id={reply.id} className="flex scroll-mt-24 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <UserLink
                    name={reply.profiles.full_name}
                    username={reply.profiles.username}
                    className="text-[13px] font-normal text-gray-900"
                    hideBadge
                  />
                  {reply.edited_at && <HistoryPopup comment={reply} />}
                  <span className="flex-1" />
                  <span className="text-xs text-gray-400">{monthYear(reply.created_at)}</span>
                </div>
                <ReviewBody comment={reply} userProfile={userProfile} />
              </div>
            ))}
        </div>
      )}
      {replying && userProfile && (
        <div className="mt-2">
          <WriteComment
            target={{ org_id: org.id }}
            commenter={userProfile}
            replyingTo={comment}
            setReplyingTo={() => setReplying(false)}
          />
        </div>
      )}
    </article>
  )
}

// A review's or reply's words, with editing in place for its author (or a moderator).
function ReviewBody(props: { comment: CommentAndProfileAndRxns; userProfile?: Profile }) {
  const { comment, userProfile } = props
  const [editing, setEditing] = useState<false | 'author' | 'moderator'>(false)
  if (editing) {
    return (
      <CommentEdit
        comment={comment}
        asModerator={editing === 'moderator'}
        onDone={() => setEditing(false)}
      />
    )
  }
  return (
    <div className="flex items-start gap-3">
      <RichContent
        content={comment.content}
        size="sm"
        className="min-w-0 max-w-[680px] flex-1 text-gray-700"
      />
      <CommentActions
        comment={comment}
        viewerId={userProfile?.id}
        onEdit={(asModerator) => setEditing(asModerator ? 'moderator' : 'author')}
      />
    </div>
  )
}

// A review Trace collected: published elsewhere (Zvi's, Michael Dickens's), or written in comments on a
// Manifund project. Its first three lines show, the rest on click.
function PublishedReview(props: {
  review: ExternalReview
  reviewer?: { regrantor: boolean; tag?: string }
}) {
  const { review, reviewer } = props
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  useSafeLayoutEffect(() => {
    if (body.current && body.current.scrollHeight > body.current.clientHeight + 1) {
      setOverflows(true)
    }
  }, [])
  const username = manifundUsername(review.reviewerUrl)
  const link = review.sourceUrl ?? review.reviewerUrl
  // A project comment names its project in its first line: shown as where it was said, not as text.
  const { project, text } = username
    ? splitManifundReview(review.body)
    : { project: null, text: review.body }
  return (
    <article className="flex flex-col gap-1.5 border-b border-gray-100 py-5">
      <ReviewHeader
        name={
          username ? (
            <Link href={`/${username}`} className="hover:underline">
              {review.reviewer}
            </Link>
          ) : review.reviewerUrl ? (
            <a href={review.reviewerUrl} className="hover:underline">
              {review.reviewer}
            </a>
          ) : (
            review.reviewer
          )
        }
        role={username ? (reviewer?.regrantor ? 'Regrantor' : undefined) : link && hostname(link)}
        badge={username ? reviewer?.tag?.replace(/^gave/, 'Donated') : 'Published elsewhere'}
        date={review.reviewedAt}
      />
      <div
        ref={body}
        className={clsx(
          'max-w-[680px] whitespace-pre-line text-pretty text-sm leading-relaxed text-gray-700',
          !expanded && 'line-clamp-3'
        )}
      >
        {/* Collapsed, paragraph breaks don't spend one of the three lines. */}
        <MarkdownLinks text={text.replace(/\n\s*\n/g, expanded ? '\n\n' : '\n')} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
        {overflows && (
          <button
            type="button"
            className="text-orange-600 hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        {project ? (
          <span>
            Commented on{' '}
            <a href={link ?? project.href} className="hover:text-gray-700 hover:underline">
              {project.title}
            </a>
          </span>
        ) : (
          link && (
            <a href={link} className="hover:text-gray-700 hover:underline">
              Full post ↗
            </a>
          )
        )}
      </div>
    </article>
  )
}

// Trace stores review text as Markdown; links and bold are the markup these use.
function MarkdownLinks(props: { text: string }) {
  const parts = props.text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*\n]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
        if (link) {
          return (
            <a key={i} href={link[2]} className="text-orange-600 hover:underline">
              {link[1]}
            </a>
          )
        }
        const bold = part.match(/^\*\*([^*\n]+)\*\*$/)
        if (bold) {
          return (
            <span key={i} className="font-normal text-gray-900">
              {bold[1]}
            </span>
          )
        }
        return part
      })}
    </>
  )
}
