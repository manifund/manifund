'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/button'
import { Row } from '@/components/layout/row'

// The two outcomes of a report (C20). Dismissing closes the reports and leaves the comment as it is.
// Removing asks for the public reason first, then closes the reports too.
export function ResolveReport(props: {
  commentId: string
  reportCount: number
  alreadyRemoved: boolean
}) {
  const { commentId, reportCount, alreadyRemoved } = props
  const [removing, setRemoving] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const resolve = async (resolution: 'dismissed' | 'removed') => {
    setBusy(true)
    const res = await fetch(`/api/comments/${commentId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, reason }),
    })
    setBusy(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'Failed')
      return
    }
    router.refresh()
  }
  const reports = reportCount === 1 ? 'report' : `${reportCount} reports`
  const dismissLabel = `Dismiss ${reports}`

  if (removing) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (public, shown in place of the comment)"
          maxLength={500}
          className="w-full rounded-md border-gray-300 text-sm focus:border-rose-400 focus:ring-0"
        />
        <Row className="items-center justify-end gap-3">
          <Row className="items-center gap-3">
            <button
              onClick={() => setRemoving(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <Button
              size="xs"
              color="rose"
              loading={busy}
              disabled={!reason.trim()}
              onClick={() => resolve('removed')}
            >
              Remove comment
            </Button>
          </Row>
        </Row>
      </div>
    )
  }
  return (
    <Row className="mt-3 items-center justify-between gap-3">
      <Button size="xs" color="gray" loading={busy} onClick={() => resolve('dismissed')}>
        {dismissLabel}
      </Button>
      {!alreadyRemoved && (
        <Button size="xs" color="rose" onClick={() => setRemoving(true)}>
          Remove comment
        </Button>
      )}
    </Row>
  )
}
