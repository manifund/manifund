'use client'

import * as RxSlider from '@radix-ui/react-slider'
import clsx from 'clsx'
import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import {
  CUSTOM_CAUSE_PLACEHOLDER,
  DEFAULT_CAUSE_ALLOCATION,
  causeColor,
  rebalanceAllocation,
  type CauseAllocation,
} from '@/utils/donor-survey'

// Sliders that always sum to 100, mirrored by a donut that redraws as they
// move. Causes from the default list can be zeroed but not removed; causes the
// donor adds can be removed.

export function CauseAllocationField(props: {
  value: CauseAllocation
  onChange: (v: CauseAllocation) => void
}) {
  const { value, onChange } = props
  const [custom, setCustom] = useState('')
  const [active, setActive] = useState<number | null>(null)
  const defaultNames = new Set(DEFAULT_CAUSE_ALLOCATION.map((c) => c.name))

  const addCustom = () => {
    const name = custom.trim()
    if (!name || value.some((c) => c.name.toLowerCase() === name.toLowerCase())) return
    onChange([...value, { name, pct: 0 }])
    setCustom('')
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
      <div className="mx-auto shrink-0 sm:sticky sm:top-6 sm:mx-0">
        <Donut allocation={value} active={active} />
      </div>
      <div className="flex min-w-0 grow flex-col gap-3">
        {value.map((cause, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_3.5rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_10rem_1fr_3.5rem]"
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          >
            <span
              aria-hidden
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: causeColor(i) }}
            />
            <span className="flex min-w-0 items-center gap-1 text-base text-gray-900">
              <span className="truncate">{cause.name}</span>
              {!defaultNames.has(cause.name) && (
                <button
                  type="button"
                  aria-label={`Remove ${cause.name}`}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                  onClick={() => onChange(rebalanceAfterRemove(value, i))}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </span>
            <span className="col-start-3 row-start-1 w-14 text-right text-base tabular-nums text-gray-700 sm:col-start-4">
              {cause.pct}%
            </span>
            <div className="col-span-3 sm:col-span-1 sm:col-start-3 sm:row-start-1">
              <RxSlider.Root
                className="relative flex h-6 w-full touch-none select-none items-center"
                value={[cause.pct]}
                min={0}
                max={100}
                step={1}
                aria-label={cause.name}
                onValueChange={([v]) => onChange(rebalanceAllocation(value, i, v))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <RxSlider.Track className="relative h-1.5 grow rounded-full bg-gray-200">
                  <RxSlider.Range
                    className="absolute h-full rounded-full"
                    style={{ backgroundColor: causeColor(i) }}
                  />
                </RxSlider.Track>
                <RxSlider.Thumb
                  className="block h-5 w-5 rounded-full border-2 bg-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                  style={{ borderColor: causeColor(i) }}
                />
              </RxSlider.Root>
            </div>
          </div>
        ))}
        <div className="mt-1 flex gap-2">
          <input
            className="min-w-0 grow rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            placeholder={CUSTOM_CAUSE_PLACEHOLDER}
            value={custom}
            maxLength={80}
            onChange={(e) => setCustom(e.target.value)}
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
            disabled={!custom.trim()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function rebalanceAfterRemove(allocation: CauseAllocation, index: number) {
  const removed = allocation[index]
  const rest = allocation.filter((_, i) => i !== index)
  if (rest.length === 0) return rest
  if (removed.pct === 0) return rest
  // Give the removed share to whichever cause is largest; a second rebalance
  // pass with the same value keeps everything at 100 without changing it.
  const largest = rest.reduce((a, c, i) => (c.pct > rest[a].pct ? i : a), 0)
  return rest.map((c, i) => (i === largest ? { ...c, pct: c.pct + removed.pct } : c))
}

const R = 42
const CIRC = 2 * Math.PI * R

export function Donut(props: {
  allocation: CauseAllocation
  active?: number | null
  size?: number
  className?: string
}) {
  const { allocation, active = null, size = 176, className } = props
  const segments = allocation.filter((c) => c.pct > 0)
  const gap = segments.length > 1 ? 1.5 : 0
  let offset = 0
  const centerIndex =
    active ?? allocation.reduce((a, c, i) => (c.pct > allocation[a].pct ? i : a), 0)
  const center = allocation[centerIndex]
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={clsx('shrink-0', className)}
      role="img"
      aria-label={allocation.map((c) => `${c.name} ${c.pct}%`).join(', ')}
    >
      <circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4f6" strokeWidth="12" />
      {allocation.map((c, i) => {
        if (c.pct <= 0) return null
        const length = Math.max(0, (c.pct / 100) * CIRC - gap)
        const dash = `${length} ${CIRC - length}`
        const el = (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={causeColor(i)}
            strokeWidth={active === i ? 14 : 12}
            strokeDasharray={dash}
            strokeDashoffset={-offset + CIRC / 4}
            style={{
              transition: 'stroke-dasharray 120ms ease-out, stroke-dashoffset 120ms ease-out',
            }}
            opacity={active === null || active === i ? 1 : 0.35}
          >
            <title>{`${c.name}: ${c.pct}%`}</title>
          </circle>
        )
        offset += (c.pct / 100) * CIRC
        return el
      })}
      {center && (
        <>
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-gray-900"
            fontSize="14"
            fontWeight="600"
          >
            {center.pct}%
          </text>
          <text x="50" y="60" textAnchor="middle" className="fill-gray-500" fontSize="6.5">
            {center.name.length > 22 ? center.name.slice(0, 21) + '…' : center.name}
          </text>
        </>
      )}
    </svg>
  )
}
