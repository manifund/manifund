'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/button'

// Clear (the account can post) or ban (superban: the account and everything it wrote are deleted).
export function ResolveHold(props: { profileId: string; username: string }) {
  const { profileId, username } = props
  const [busy, setBusy] = useState<false | 'clear' | 'ban'>(false)
  const [confirmBan, setConfirmBan] = useState(false)
  const router = useRouter()
  const resolve = async (action: 'clear' | 'ban') => {
    setBusy(action)
    const res = await fetch(`/api/account-holds/${profileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'Failed')
      return
    }
    toast.success(action === 'clear' ? `@${username} can post now` : `@${username} was banned`)
    router.refresh()
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="xs" color="gray" loading={busy === 'clear'} onClick={() => resolve('clear')}>
        Clear
      </Button>
      {confirmBan ? (
        <Button size="xs" color="rose" loading={busy === 'ban'} onClick={() => resolve('ban')}>
          Confirm: delete @{username} and everything they posted
        </Button>
      ) : (
        <Button size="xs" color="rose" onClick={() => setConfirmBan(true)}>
          Ban
        </Button>
      )}
    </div>
  )
}
