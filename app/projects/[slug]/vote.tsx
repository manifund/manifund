'use client'
import { Karma } from '@/components/karma'
import { Tooltip } from '@/components/tooltip'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useState } from 'react'
import { scrollToComments } from './project-display'

// Vote arrows around the project's karma: ▲ karma ▼. The parent owns the viewer's vote so karma
// moves at once. The viewer's vote is worth `weight` karma (log of their own karma), so each vote
// briefly shows what it changed, e.g. "+3", and the arrows say what they're worth.
export function VoteKarma(props: {
  projectId: string
  karma: number
  breakdown: unknown
  magnitude: number
  setMagnitude: (magnitude: number) => void
  setCommentPrompt: (value: string) => void
  weight: number
  userId?: string
  isCreator?: boolean
}) {
  const { projectId, karma, breakdown, magnitude, setMagnitude, setCommentPrompt, weight, userId } =
    props
  // Each vote gets a fresh key so the "+3" flash replays.
  const [flash, setFlash] = useState<{ key: number; delta: number } | null>(null)
  const canVote = !!userId
  const worth = Math.round(weight * 10) / 10

  const vote = async (clicked: number) => {
    if (!userId) return
    const newMagnitude = magnitude === clicked ? 0 : clicked
    const delta = (newMagnitude - magnitude) * weight
    setMagnitude(newMagnitude)
    if (delta !== 0) setFlash({ key: Date.now(), delta })
    await fetch(`/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, newMagnitude }),
    })
    if (newMagnitude !== 0) {
      scrollToComments()
      setCommentPrompt(`why did you ${clicked > 0 ? 'up' : 'down'}vote?`)
    }
  }

  const hint = (direction: 1 | -1) => {
    if (!userId) return 'Sign in to vote'
    if (props.isCreator) return direction > 0 ? 'Upvote' : 'Downvote'
    if (magnitude === direction) return 'Undo your vote'
    return `${direction > 0 ? 'Upvote' : 'Downvote'}: ${direction > 0 ? '+' : '−'}${worth} karma`
  }

  return (
    <div className="flex min-w-[3.5rem] flex-none flex-col items-center">
      <VoteArrow
        direction={1}
        active={magnitude > 0}
        disabled={!canVote}
        hint={hint(1)}
        onClick={() => vote(1)}
      />
      <div className="relative">
        <Karma value={karma} breakdown={breakdown} kind="project" size="lg" placement="right" />
        {flash && (
          <span
            key={flash.key}
            aria-hidden
            onAnimationEnd={() => setFlash(null)}
            className={clsx(
              'pointer-events-none absolute left-full top-0 ml-1 animate-karma-flash text-xs font-medium tabular-nums motion-reduce:hidden',
              flash.delta > 0 ? 'text-orange-600' : 'text-gray-500'
            )}
          >
            {flash.delta > 0 ? '+' : '−'}
            {Math.abs(Math.round(flash.delta * 10) / 10)}
          </span>
        )}
      </div>
      <VoteArrow
        direction={-1}
        active={magnitude < 0}
        disabled={!canVote}
        hint={hint(-1)}
        onClick={() => vote(-1)}
      />
    </div>
  )
}

function VoteArrow(props: {
  direction: 1 | -1
  active: boolean
  disabled: boolean
  hint: string
  onClick: () => void
}) {
  const { direction, active, disabled, hint, onClick } = props
  const Icon = direction > 0 ? ChevronUpIcon : ChevronDownIcon
  return (
    <Tooltip text={hint} placement="right" noTap>
      <button
        aria-label={hint}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          'flex h-7 w-7 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
          active
            ? 'bg-orange-100 text-orange-600'
            : 'text-gray-400 enabled:hover:bg-gray-100 enabled:hover:text-gray-700',
          disabled && 'cursor-default'
        )}
      >
        <Icon className="h-6 w-6" />
      </button>
    </Tooltip>
  )
}
