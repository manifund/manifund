'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'

// One look for following a person and following a project: a small button with a bookmark,
// outlined and grey to follow, filled and orange while following. Clicking again unfollows. While a click is being
// saved, further clicks are ignored rather than disabling the button, so it keeps its colour.
export function FollowToggle(props: {
  following: boolean
  onClick: () => void
  busy?: boolean
  error?: boolean
}) {
  const { following, onClick, busy, error } = props
  const Icon = following ? BookmarkSolid : BookmarkOutline
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-rose-600">Couldn&apos;t save. Try again.</span>}
      <Button
        className="flex gap-1"
        color={following ? 'light-orange' : 'gray'}
        size="2xs"
        onClick={() => !busy && onClick()}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {following ? 'Following' : 'Follow'}
      </Button>
    </span>
  )
}

// F1: follows or unfollows a person. Following covers everything they do.
export function FollowButton(props: { followedId: string; following: boolean }) {
  const { followedId } = props
  const [following, setFollowing] = useState(props.following)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/follows', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followedId }),
      })
      if (res.status === 401) return router.push('/login')
      if (!res.ok) return setError(true)
      setFollowing(!following)
      router.refresh() // the Following tab and counts
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return <FollowToggle following={following} onClick={toggle} busy={busy} error={error} />
}
