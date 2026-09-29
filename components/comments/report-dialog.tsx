'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/modal'
import { Button } from '@/components/button'

// Report a comment to the admins: an optional note and a spam toggle (decided 2026-09-28).
export function ReportDialog(props: {
  commentId: string
  open: boolean
  setOpen: (o: boolean) => void
}) {
  const { commentId, open, setOpen } = props
  const [isSpam, setIsSpam] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    const res = await fetch(`/api/comments/${commentId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSpam, note }),
    })
    setSending(false)
    if (res.ok) {
      toast.success('Thanks, the admins will take a look')
      setOpen(false)
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Could not send the report' }))
      toast.error(error)
    }
  }

  return (
    <Modal open={open} setOpen={setOpen}>
      <h2 className="mb-1 text-lg font-medium">Report this comment</h2>
      <p className="mb-3 text-sm text-gray-500">
        Admins review reports. The author isn&apos;t told who reported them.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isSpam}
          onChange={(e) => setIsSpam(e.target.checked)}
          className="rounded text-orange-500"
        />
        This is spam
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What's the problem? (optional)"
        maxLength={2000}
        rows={3}
        className="w-full rounded-md border-gray-300 text-sm focus:border-orange-500 focus:ring-orange-500"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button color="gray" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button loading={sending} onClick={send}>
          Send report
        </Button>
      </div>
    </Modal>
  )
}
