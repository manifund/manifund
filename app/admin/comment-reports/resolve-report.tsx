'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/button'
import { RichContent } from '@/components/editor'
import clsx from 'clsx'

// The two outcomes of a report (C20), in one row so a queue can be worked through quickly: Dismiss
// on the left (the comment stays); on the right, the public reason and Remove comment (one click
// once a reason is typed). Either closes the comment's open reports.
export function ResolveReport(props: {
  commentId: string
  reportCount: number
  alreadyRemoved: boolean
}) {
  const { commentId, reportCount, alreadyRemoved } = props
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<false | 'dismissed' | 'removed'>(false)
  const router = useRouter()
  const resolve = async (resolution: 'dismissed' | 'removed') => {
    setBusy(resolution)
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
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        size="xs"
        color="gray"
        loading={busy === 'dismissed'}
        onClick={() => resolve('dismissed')}
      >
        {reportCount === 1 ? 'Dismiss report' : `Dismiss ${reportCount} reports`}
      </Button>
      {!alreadyRemoved && (
        <div className="ml-auto flex min-w-[18rem] flex-1 items-center gap-2 sm:ml-6">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reason.trim()) void resolve('removed')
            }}
            placeholder="Reason for removing"
            maxLength={500}
            className="min-w-0 flex-1 rounded-md border-gray-300 py-1.5 text-sm focus:border-rose-400 focus:ring-0"
          />
          <Button
            size="xs"
            color="rose"
            loading={busy === 'removed'}
            disabled={!reason.trim()}
            onClick={() => resolve('removed')}
          >
            Remove comment
          </Button>
        </div>
      )}
    </div>
  )
}

// Long comments take a few lines in the queue; "Show all" appears only when some text is cut off.
export function ClampedContent(props: { content: unknown }) {
  const [open, setOpen] = useState(false)
  const [cut, setCut] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (box.current) setCut(box.current.scrollHeight > box.current.clientHeight + 1)
  }, [])
  return (
    <div>
      <div ref={box} className={clsx(!open && 'line-clamp-6')}>
        <RichContent content={props.content} className="text-sm" />
      </div>
      {cut && !open && (
        <button
          onClick={() => setOpen(true)}
          className="mt-1 text-xs text-gray-500 hover:underline"
        >
          Show all
        </button>
      )}
    </div>
  )
}
