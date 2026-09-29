'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Comment } from '@/db/comment'
import { ReportDialog } from './report-dialog'

// What the viewer may do with a comment: its author edits or deletes; anyone else signed in
// reports. Admin removal happens from the admin queue.
export function CommentActions(props: { comment: Comment; viewerId?: string; onEdit: () => void }) {
  const { comment, viewerId, onEdit } = props
  const [reporting, setReporting] = useState(false)
  const router = useRouter()
  if (!viewerId || comment.deleted_at) return null
  const link = 'text-xs text-gray-400 hover:text-gray-700 hover:underline'

  if (comment.commenter === viewerId) {
    const del = async () => {
      if (!confirm('Delete this comment? A "deleted by the author" note stays in its place.'))
        return
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
      if (!res.ok) toast.error((await res.json().catch(() => ({}))).error ?? 'Could not delete')
      router.refresh()
    }
    return (
      <span className="flex gap-2">
        <button className={link} onClick={onEdit}>
          Edit
        </button>
        <button className={link} onClick={del}>
          Delete
        </button>
      </span>
    )
  }
  return (
    <>
      <button className={link} onClick={() => setReporting(true)}>
        Report
      </button>
      <ReportDialog commentId={comment.id} open={reporting} setOpen={setReporting} />
    </>
  )
}
