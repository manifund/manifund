'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

// F1, F2: one button that follows or unfollows. Following covers everything the person does. Private: only you
// see who you follow.
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
    if (res.ok) setFollowing(!following)
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      aria-pressed={following}
      title="Only you see who you follow"
      className={clsx(
        'group flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60',
        following
          ? 'border border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:text-red-600'
          : 'bg-orange-500 text-white hover:bg-orange-600'
      )}
    >
      {following ? (
        <>
          <CheckIcon className="h-4 w-4 text-orange-500 group-hover:hidden" aria-hidden="true" />
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        'Follow'
      )}
    </button>
  )
}
