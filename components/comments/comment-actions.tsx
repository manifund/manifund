'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Menu } from '@headlessui/react'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
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
  const isAuthor = comment.commenter === viewerId
  if (isAuthor) {
    return (
      <button
        className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
        onClick={() => onEdit(false)}
      >
        Edit
      </button>
    )
  }
  // Everyone else: the rarer actions sit in a menu, so the card stays quiet.
  const items = isModerator
    ? [
        { label: 'Edit', onClick: () => onEdit(true) },
        { label: 'Remove', onClick: () => setRemoving(true) },
      ]
    : [{ label: 'Report', onClick: () => setReporting(true) }]
  return (
    <>
      <Menu as="div" className="relative">
        <Menu.Button
          aria-label="More"
          className="flex rounded text-gray-400 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </Menu.Button>
        <Menu.Items className="absolute right-0 z-20 mt-1 min-w-[7rem] rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none">
          {items.map((item) => (
            <Menu.Item key={item.label}>
              {({ active }) => (
                <button
                  onClick={item.onClick}
                  className={clsx(
                    'block w-full px-3 py-1.5 text-left text-gray-700',
                    active && 'bg-gray-100'
                  )}
                >
                  {item.label}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Menu>
      {isModerator ? (
        <RemoveDialog commentId={comment.id} open={removing} setOpen={setRemoving} />
      ) : (
        <ReportDialog commentId={comment.id} open={reporting} setOpen={setReporting} />
      )}
    </>
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
      <p className="mb-3 text-sm text-gray-500">
        The reason will be shown in place of the comment. The author will be notified.
      </p>
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
