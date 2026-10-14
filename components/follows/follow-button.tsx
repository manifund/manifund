'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/20/solid'
import { Button } from '@/components/button'

// One look for following a person and following a project (Vals, 2026-10-14): a small button with a bookmark,
// outlined and grey to follow, filled and orange while following. Clicking again unfollows.
export function FollowToggle(props: {
  following: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const { following, onClick, disabled } = props
  const Icon = following ? BookmarkSolid : BookmarkOutline
  return (
    <Button
      className="flex gap-1"
      color={following ? 'light-orange' : 'gray'}
      size="2xs"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}

// F1: follows or unfollows a person. Following covers everything they do.
export function FollowButton(props: { followedId: string; following: boolean }) {
  const { followedId } = props
  const [following, setFollowing] = useState(props.following)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    setBusy(true)
    const res = await fetch('/api/follows', {
      method: following ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followedId }),
    })
    setBusy(false)
    if (res.status === 401) router.push('/login')
    if (res.ok) {
      setFollowing(!following)
      router.refresh() // the profile's follower list follows
    }
  }

  return <FollowToggle following={following} onClick={toggle} disabled={busy} />
}
