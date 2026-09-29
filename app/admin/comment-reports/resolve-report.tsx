'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/button'

export function ResolveReport(props: { commentId: string }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const resolve = async (resolution: 'dismissed' | 'removed') => {
    setBusy(true)
    const res = await fetch(`/api/comments/${props.commentId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, reason }),
    })
    setBusy(false)
    if (!res.ok) toast.error((await res.json().catch(() => ({}))).error ?? 'Failed')
    router.refresh()
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Public reason, shown in place of the comment"
        className="min-w-[16rem] flex-1 rounded-md border-gray-300 text-sm"
      />
      <Button size="xs" color="gray" loading={busy} onClick={() => resolve('dismissed')}>
        Dismiss
      </Button>
      <Button
        size="xs"
        color="rose"
        loading={busy}
        disabled={!reason.trim()}
        onClick={() => resolve('removed')}
      >
        Remove
      </Button>
    </div>
  )
}
