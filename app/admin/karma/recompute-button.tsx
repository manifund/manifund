'use client'

import { Button } from '@/components/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

export function RecomputeKarmaButton() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  return (
    <Button
      size="sm"
      color="orange"
      loading={isSubmitting}
      onClick={async () => {
        setIsSubmitting(true)
        const response = await fetch('/api/karma/recompute', { method: 'POST' })
        setIsSubmitting(false)
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(body?.error ?? 'Recompute failed.')
          return
        }
        toast.success(
          `Recomputed: ${body.profilesWritten} profiles and ${body.projectsWritten} projects updated`
        )
        router.refresh()
      }}
    >
      Recompute now
    </Button>
  )
}
