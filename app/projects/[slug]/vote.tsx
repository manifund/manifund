'use client'
import { Col } from '@/components/layout/col'
import { ProjectVote } from '@/db/project'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { scrollToComments } from './project-display'

export const revalidate = 60

export function Vote(props: {
  projectId: string
  votes: ProjectVote[]
  setCommentPrompt: (value: string) => void
  userId?: string
  onVoteChange?: (magnitudeDelta: number) => void
}) {
  const { projectId, votes, setCommentPrompt, userId, onVoteChange } = props
  const oldVote = votes.find((vote) => vote.voter_id === userId)
  const oldMagnitude = oldVote ? oldVote.magnitude : 0
  const [newMagnitude, setNewMagnitude] = useState<null | number>(null)
  const router = useRouter()
  const displayMagnitude = newMagnitude ?? oldMagnitude

  const vote = async (magnitude: number) => {
    if (!userId) return
    const nextMagnitude = displayMagnitude === magnitude ? 0 : magnitude
    setNewMagnitude(nextMagnitude)
    onVoteChange?.(nextMagnitude - displayMagnitude)
    await fetch(`/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        newMagnitude: displayMagnitude === magnitude ? 0 : magnitude,
      }),
    })
    if (displayMagnitude !== magnitude) {
      scrollToComments(router)
      setCommentPrompt(`why did you ${magnitude > 0 ? 'up' : 'down'}vote?`)
    }
  }
  return (
    <Col className="relative items-center gap-2">
      <ChevronUpIcon
        className={clsx(
          'h-8 w-8 stroke-2',
          displayMagnitude > 0 ? 'text-orange-500' : ' text-gray-400',
          userId && 'cursor-pointer'
        )}
        onClick={async () => await vote(1)}
      />
      <span className="absolute top-6 text-gray-400">
        {votes
          .filter((vote) => vote.voter_id !== userId)
          .reduce((acc, vote) => vote.magnitude + acc, 0) + displayMagnitude}
      </span>
      <ChevronDownIcon
        className={clsx(
          'h-8 w-8 stroke-2',
          displayMagnitude < 0 ? 'text-orange-500' : ' text-gray-400',
          userId && 'cursor-pointer'
        )}
        onClick={async () => await vote(-1)}
      />
    </Col>
  )
}
