'use client'
import type { JSONContent } from '@tiptap/core'
import Link from 'next/link'
import { type Comment } from '@/db/comment'
import { categoryText } from '@/utils/moderation-labels'
import { useViewerIsAdmin } from './use-viewer-is-admin'

// The collapsed placeholder for a comment held for review (C40).
export function HeldNotice(props: { comment: Comment; isAuthor: boolean; onReveal?: () => void }) {
  const { comment, isAuthor, onReveal } = props
  const admin = useViewerIsAdmin()
  return (
    <div className="ml-10 w-full rounded-xl rounded-tl-sm border border-dashed border-amber-300 bg-amber-50/50 px-4 py-2 text-sm text-gray-600">
      <span className="italic">
        Comment hidden pending review: {categoryText(comment.held_categories)}.
      </span>
      {onReveal ? (
        <button className="ml-2 text-xs text-gray-500 underline" onClick={onReveal}>
          Show comment
        </button>
      ) : (
        <span className="ml-2 text-xs text-gray-400">
          {isAuthor
            ? 'Only the Manifund team can see it until it’s reviewed.'
            : 'It can’t be shown until it’s reviewed.'}
        </span>
      )}
      {admin && (
        <Link href="/admin/comment-reports" className="ml-2 text-xs text-orange-600 underline">
          Review
        </Link>
      )}
    </div>
  )
}

// The same document with every link mark dropped, so its links read as plain text.
export function withoutLinks(content: JSONContent | null | unknown): JSONContent | null {
  if (!content || typeof content !== 'object') return null
  const strip = (node: JSONContent): JSONContent => ({
    ...node,
    marks: node.marks?.filter((m) => m.type !== 'link'),
    content: node.content?.map(strip),
  })
  return strip(content as JSONContent)
}
