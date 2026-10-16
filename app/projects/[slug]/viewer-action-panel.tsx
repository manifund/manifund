'use client'

import { Button } from '@/components/button'
import { Row } from '@/components/layout/row'
import { LinkIcon } from '@heroicons/react/20/solid'
import { FollowToggle } from '@/components/follows/follow-button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function ViewerActionPanel(props: {
  projectId: string
  projectSlug: string
  currentlyFollowing: boolean
}) {
  const { projectId, projectSlug, currentlyFollowing } = props
  const [displayAsFollowing, setDisplayAsFollowing] = useState(currentlyFollowing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const router = useRouter()
  return (
    <Row className="flex items-center justify-end gap-2">
      <Button
        className="flex gap-0.5"
        color="light-orange"
        size="2xs"
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}/projects/${projectSlug}`)
        }}
      >
        <LinkIcon className="relative right-0.5 h-4 w-4 stroke-2" />
        Share
      </Button>
      <FollowToggle
        following={displayAsFollowing}
        busy={busy}
        error={error}
        onClick={async () => {
          const before = displayAsFollowing
          setDisplayAsFollowing(!before)
          setBusy(true)
          setError(false)
          try {
            const res = await fetch('/api/toggle-follow', {
              method: 'POST',
              body: JSON.stringify({ projectId: projectId }),
            })
            if (!res.ok) throw new Error(String(res.status))
            router.refresh()
          } catch {
            setDisplayAsFollowing(before)
            setError(true)
          } finally {
            setBusy(false)
          }
        }}
      />
    </Row>
  )
}
