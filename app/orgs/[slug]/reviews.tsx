'use client'
import Link from 'next/link'
import { buttonClass } from '@/components/button'
import { CommentsSection } from '@/components/comments/comments-section'
import type { CommentAndProfileAndRxns } from '@/db/comment'
import type { ExternalReview, Org } from '@/db/org'
import type { Profile } from '@/db/profile'

// Ratings aren't stored yet: until they are, every community review counts as five stars.
export const ASSUMED_RATING = 5
const STARS = '★'.repeat(ASSUMED_RATING)

export function Reviews(props: {
  org: Org
  comments: CommentAndProfileAndRxns[]
  externalReviews: ExternalReview[]
  commenterTags: Record<string, string>
  userProfile?: Profile
  userCharityBalance: number
}) {
  const { org, comments, externalReviews, commenterTags, userProfile, userCharityBalance } = props
  const count = comments.filter((c) => !c.replying_to && !c.deleted_at).length
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-normal tracking-tight text-gray-900">Reviews</h2>
        <Link
          href={userProfile ? '#main-write-comment' : `/login?next=/orgs/${org.slug}`}
          className={buttonClass('sm', 'orange-outline')}
        >
          Write a review
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {count > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-8 border-b border-gray-100 pb-5">
            <div>
              <div className="text-[40px] font-normal leading-none text-gray-900">
                {ASSUMED_RATING.toFixed(1)}
              </div>
              <div className="mt-1 tracking-[2px] text-orange-500">{STARS}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {count} community review{count === 1 ? '' : 's'}
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
          </div>
        )}
        <CommentsSection
          target={{ org_id: org.id }}
          basePath={`/orgs/${org.slug}`}
          comments={comments}
          commenterTags={commenterTags}
          threadTag={STARS}
          userProfile={userProfile}
          userCharityBalance={userCharityBalance}
          placeholder={`What should donors know about ${org.name}?`}
          emptyText="No reviews yet."
        />
      </div>

      {externalReviews.length > 0 && (
        <div className="rounded-lg bg-white px-6 py-2 shadow-sm">
          {externalReviews.map((review) => (
            <ExternalReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}
    </>
  )
}

// A review published elsewhere. Its first paragraph is the reviewer's one-line verdict; the rest
// opens on click.
function ExternalReviewRow(props: { review: ExternalReview }) {
  const { review } = props
  const [lead, ...rest] = review.body.split(/\n\s*\n/)
  const link = review.sourceUrl ?? review.reviewerUrl
  return (
    <article className="flex flex-col gap-1.5 border-b border-gray-100 py-5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-normal text-gray-900">{review.reviewer}</span>
        <span className="rounded bg-gray-100 px-1.5 py-px text-[11px] text-gray-600">
          Published elsewhere
        </span>
        <span className="flex-1" />
        {link && (
          <a href={link} className="text-xs text-orange-600 hover:underline">
            Full post ↗
          </a>
        )}
        <span className="text-xs text-gray-400">
          {new Date(`${review.reviewedAt}T00:00:00Z`).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          })}
        </span>
      </div>
      <p className="max-w-[680px] text-sm font-normal leading-relaxed text-gray-900">
        <MarkdownLinks text={lead} />
      </p>
      {rest.length > 0 && (
        <details className="group max-w-[680px] text-sm leading-relaxed text-gray-700">
          <summary className="cursor-pointer list-none text-xs text-orange-600 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Read more</span>
            <span className="hidden group-open:inline">Show less</span>
          </summary>
          {rest.map((paragraph, i) => (
            <p key={i} className="mt-2">
              <MarkdownLinks text={paragraph} />
            </p>
          ))}
        </details>
      )}
    </article>
  )
}

// Trace stores review text as Markdown; links are the only markup these use.
function MarkdownLinks(props: { text: string }) {
  const parts = props.text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
        return match ? (
          <a key={i} href={match[2]} className="text-orange-600 hover:underline">
            {match[1]}
          </a>
        ) : (
          part
        )
      })}
    </>
  )
}
