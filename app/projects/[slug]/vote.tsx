'use client'
import { Col } from '@/components/layout/col'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'
import { scrollToComments } from './project-display'

export const revalidate = 60

// Vote arrows around `children` (the project's karma). The parent owns the
// viewer's vote so it can update karma and the vote counts optimistically.
export function Vote(props: {
  projectId: string
  magnitude: number
  setMagnitude: (magnitude: number) => void
  setCommentPrompt: (value: string) => void
  userId?: string
  children: ReactNode
}) {
  const { projectId, magnitude, setMagnitude, setCommentPrompt, userId, children } = props
  const router = useRouter()

  const vote = async (clicked: number) => {
    if (!userId) return
    const newMagnitude = magnitude === clicked ? 0 : clicked
    setMagnitude(newMagnitude)
    await fetch(`/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, newMagnitude }),
    })
    if (newMagnitude !== 0) {
      scrollToComments(router)
      setCommentPrompt(`why did you ${clicked > 0 ? 'up' : 'down'}vote?`)
    }
  }
  return (
    <Col className="items-center">
      <button aria-label="Upvote" disabled={!userId} onClick={async () => await vote(1)}>
        <ChevronUpIcon
          className={clsx(
            '-my-1 h-7 w-7 stroke-2',
            magnitude > 0 ? 'text-orange-500' : 'text-gray-400'
          )}
        />
      </button>
      {children}
      <button aria-label="Downvote" disabled={!userId} onClick={async () => await vote(-1)}>
        <ChevronDownIcon
          className={clsx(
            '-my-1 h-7 w-7 stroke-2',
            magnitude < 0 ? 'text-orange-500' : 'text-gray-400'
          )}
        />
      </button>
    </Col>
  )
}
