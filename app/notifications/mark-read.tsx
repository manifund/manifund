'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Opening the page marks everything read (the highlight stays until the next visit).
export function MarkRead() {
  const router = useRouter()
  useEffect(() => {
    void fetch('/api/notifications/read', { method: 'POST' }).then(() => router.prefetch('/'))
  }, [router])
  return null
}
