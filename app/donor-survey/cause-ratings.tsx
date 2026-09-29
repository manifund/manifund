'use client'

import clsx from 'clsx'
import { useState } from 'react'
import { CAUSES, MAX_RATING, TOP_CAUSE_COUNT, type CauseRatings } from '@/utils/donor-survey'
import { inputClass } from './fields'

// A rating dot: filled up to the chosen rating.
function Dot(props: { on: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={clsx(
        props.on ? 'fill-orange-400 stroke-orange-400' : 'fill-none stroke-gray-300',
        props.className
      )}
      strokeWidth="1.6"
    >
      <circle cx="10" cy="10" r="7" />
    </svg>
  )
}

// Read-only dots, for the donor page.
export function RatingDots(props: { rating: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${props.rating} of ${MAX_RATING}`}
      className="inline-flex gap-0.5"
    >
      {Array.from({ length: MAX_RATING }, (_, i) => (
        <Dot key={i} on={i < Math.round(props.rating)} className={props.className ?? 'h-4 w-4'} />
      ))}
    </span>
  )
}

// One row per cause: its name and five tappable dots. Tapping the current
// rating again clears it.
function RatingRow(props: { name: string; rating: number; onChange: (rating: number) => void }) {
  const { name, rating, onChange } = props
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="min-w-0 text-[15px] text-gray-900 [overflow-wrap:anywhere]">{name}</span>
      <div role="group" aria-label={name} className="flex flex-none">
        {Array.from({ length: MAX_RATING }, (_, i) => {
          const value = i + 1
          return (
            <button
              key={value}
              type="button"
              aria-label={`${value} of ${MAX_RATING}`}
              aria-pressed={rating === value}
              onClick={() => onChange(rating === value ? 0 : value)}
              className="group grid h-9 w-8 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-orange-100"
            >
              <Dot
                on={value <= rating}
                className={clsx(
                  'h-6 w-6 transition-colors',
                  value > rating && 'group-hover:stroke-orange-300'
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CauseRatingsInput(props: {
  value: CauseRatings
  onChange: (v: CauseRatings) => void
}) {
  const { value, onChange } = props
  // Causes the donor added, including ones from a saved response.
  const [custom, setCustom] = useState(() =>
    value.map((c) => c.name).filter((n) => !CAUSES.includes(n))
  )
  const [draft, setDraft] = useState('')
  const top = CAUSES.slice(0, TOP_CAUSE_COUNT)
  const rest = [...CAUSES.slice(TOP_CAUSE_COUNT), ...custom]
  const [expanded, setExpanded] = useState(() => value.some((c) => !top.includes(c.name)))

  const ratingOf = (name: string) => value.find((c) => c.name === name)?.rating ?? 0
  const setRating = (name: string, rating: number) => {
    const others = value.filter((c) => c.name !== name)
    onChange(rating ? [...others, { name, rating }] : others)
  }
  const addCustom = () => {
    const name = draft.trim()
    const taken = [...CAUSES, ...custom].some((n) => n.toLowerCase() === name.toLowerCase())
    if (!name || taken) return
    setCustom([...custom, name])
    setDraft('')
  }

  const row = (name: string) => (
    <RatingRow
      key={name}
      name={name}
      rating={ratingOf(name)}
      onChange={(r) => setRating(name, r)}
    />
  )

  return (
    <div className="flex flex-col gap-1">
      {top.map(row)}
      {expanded ? (
        <>
          {rest.map(row)}
          <div className="mt-2 flex gap-2">
            <input
              className={clsx(
                inputClass,
                'h-10 min-w-0 flex-1 border-dashed border-gray-300 px-3.5 focus:border-solid'
              )}
              placeholder="Add your own cause area"
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustom()
                }
              }}
            />
            <button
              type="button"
              onClick={addCustom}
              className="h-10 flex-none rounded-[10px] border border-gray-200 bg-white px-4 text-sm font-normal text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600"
            >
              Add
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 self-start py-1.5 text-sm font-normal text-orange-600 hover:text-orange-700"
        >
          Show {rest.length} more, or add your own →
        </button>
      )}
    </div>
  )
}
