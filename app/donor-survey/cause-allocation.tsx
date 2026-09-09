'use client'

import clsx from 'clsx'
import { useState } from 'react'
import { causeColor, normalizeAllocation } from '@/utils/donor-survey'
import { inputClass } from './fields'

export type CauseValue = { name: string; value: number }

// A stacked bar showing each cause's share. Shared by the form, the results
// page, and the donor page.
export function ProportionBar(props: {
  segments: { name: string; pct: number; color?: string }[]
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex h-3.5 gap-0.5 overflow-hidden rounded-[7px] bg-gray-100',
        props.className
      )}
      role="img"
      aria-label={props.segments.map((s) => `${s.name} ${s.pct}%`).join(', ')}
    >
      {props.segments.map((s, i) => (
        <div
          key={s.name + i}
          title={`${s.name}: ${s.pct}%`}
          className="h-full transition-[width] duration-200 ease-out"
          style={{ width: `${s.pct}%`, backgroundColor: s.color ?? causeColor(i) }}
        />
      ))}
    </div>
  )
}

export function CauseLegend(props: { segments: { name: string; pct: number; color?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-[18px] gap-y-2">
      {props.segments.map((s, i) => (
        <div key={s.name + i} className="flex items-center gap-1.5 text-[13px] text-gray-700">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: s.color ?? causeColor(i) }}
          />
          {s.name}
          <span className="text-gray-400">{s.pct}%</span>
        </div>
      ))}
    </div>
  )
}

// Independent sliders; each cause's share is its value over the total.
export function CauseSliders(props: { value: CauseValue[]; onChange: (v: CauseValue[]) => void }) {
  const { value, onChange } = props
  const [custom, setCustom] = useState('')
  const shares = normalizeAllocation(value)

  const addCustom = () => {
    const name = custom.trim()
    if (!name || value.some((c) => c.name.toLowerCase() === name.toLowerCase())) return
    onChange([...value, { name, value: 10 }])
    setCustom('')
  }

  return (
    <div className="flex flex-col gap-4">
      <ProportionBar segments={shares.map((s, i) => ({ ...s, color: causeColor(i) }))} />
      <div className="flex flex-col gap-2.5">
        {value.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(120px,170px)_1fr_44px] items-center gap-3.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 flex-none rounded-[3px]"
                style={{ backgroundColor: causeColor(i) }}
              />
              <span className="truncate text-sm text-gray-900">{c.name}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={c.value}
              aria-label={c.name}
              onChange={(e) =>
                onChange(
                  value.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x))
                )
              }
              className="w-full cursor-pointer accent-orange-500"
            />
            <span className="text-right text-[13px] tabular-nums text-gray-500">
              {shares[i]?.pct ?? 0}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={clsx(
            inputClass,
            'h-10 flex-1 border-dashed border-gray-300 px-3.5 text-sm focus:border-solid'
          )}
          placeholder="Add your own cause area"
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
          className="h-10 rounded-[10px] border border-gray-200 bg-white px-4 text-sm font-normal text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600"
        >
          Add
        </button>
      </div>
    </div>
  )
}
