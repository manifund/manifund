'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Comment } from '@/db/comment'
import { Modal } from '@/components/modal'
import { Button } from '@/components/button'
import { ReportDialog } from './report-dialog'
import { useViewerIsAdmin } from './use-viewer-is-admin'

// What the viewer may do with a comment (decided with the team 2026-09-30): its author edits (no
// deleting: strikethrough and every version stay public); moderators edit with a note or remove
// with a public reason; anyone else signed in reports.
export function CommentActions(props: {
  comment: Comment
  viewerId?: string
  onEdit: (asModerator: boolean) => void
}) {
  const { comment, viewerId, onEdit } = props
  const isModerator = useViewerIsAdmin()
  const [reporting, setReporting] = useState(false)
  const [removing, setRemoving] = useState(false)
  if (!viewerId || comment.deleted_at) return null
  const link = 'text-xs text-gray-400 hover:text-gray-700 hover:underline'
  const isAuthor = comment.commenter === viewerId

  return (
    <span className="flex gap-2">
      {isAuthor && (
        <button className={link} onClick={() => onEdit(false)}>
          Edit
        </button>
      )}
      {!isAuthor && isModerator && (
        <>
          <button className={link} onClick={() => onEdit(true)}>
            Edit
          </button>
          <button className={link} onClick={() => setRemoving(true)}>
            Remove
          </button>
          <RemoveDialog commentId={comment.id} open={removing} setOpen={setRemoving} />
        </>
      )}
      {!isAuthor && !isModerator && (
        <>
          <button className={link} onClick={() => setReporting(true)}>
            Report
          </button>
          <ReportDialog commentId={comment.id} open={reporting} setOpen={setReporting} />
        </>
      )}
    </span>
  )
}

function RemoveDialog(props: { commentId: string; open: boolean; setOpen: (o: boolean) => void }) {
  const { commentId, open, setOpen } = props
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const remove = async () => {
    setBusy(true)
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    setBusy(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'Could not remove')
      return
    }
    setOpen(false)
    router.refresh()
  }
  return (
    <Modal open={open} setOpen={setOpen}>
      <h2 className="mb-1 text-lg font-medium">Remove this comment</h2>
      <p className="mb-3 text-sm text-gray-500">The reason replaces the comment. The author is told.</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (public)"
        maxLength={500}
        className="w-full rounded-md border-gray-300 text-sm focus:border-orange-500 focus:ring-orange-500"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button color="gray" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button color="rose" loading={busy} disabled={!reason.trim()} onClick={remove}>
          Remove
        </Button>
      </div>
    </Modal>
  )
}
