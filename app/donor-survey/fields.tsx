'use client'

import clsx from 'clsx'
import { ReactNode, useId } from 'react'
import { SectionHeading } from './survey-header'

// Form primitives for the donor survey, following the Claude Design mockup:
// one 640px column, section headings with a hairline, pill single-selects,
// card-style multi-selects, and 44px inputs with an orange focus ring.
// Inputs use 16px text below the sm breakpoint so iOS doesn't zoom on focus.

export function Section(props: {
  id?: string
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <section id={props.id} className="flex scroll-mt-16 flex-col gap-8">
      <SectionHeading title={props.title} badge={props.badge} />
      {props.children}
    </section>
  )
}

export function Q(props: {
  label: ReactNode
  hint?: ReactNode
  id?: string
  as?: 'label' | 'div'
  className?: string
  children: ReactNode
}) {
  const Wrapper = props.as ?? 'div'
  return (
    <Wrapper id={props.id} className={clsx('flex flex-col gap-3', props.className)}>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-normal leading-[1.4] text-gray-900">{props.label}</span>
        {props.hint && <span className="text-sm text-gray-500">{props.hint}</span>}
      </div>
      {props.children}
    </Wrapper>
  )
}

export const inputClass =
  'w-full rounded-[10px] border border-gray-200 bg-white text-base text-gray-900 sm:text-[15px] outline-none placeholder:text-gray-400 focus:border-orange-500 focus:ring-[3px] focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-500'

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  name?: string
  className?: string
}) {
  return (
    <input
      className={clsx(inputClass, 'h-11 px-3.5', props.className)}
      type={props.type ?? 'text'}
      name={props.name}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
    />
  )
}

export function TextArea(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className={clsx(inputClass, 'resize-y px-3.5 py-3 leading-normal')}
      rows={props.rows ?? 4}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
    />
  )
}

// Single-select pills. Native radios stay in the tree, visually hidden.
// With `grid`, the first `grid` options are amount bands: three columns on
// phones, one row on desktop; any further options go on a row below.
export function Pills<K extends string>(props: {
  options: readonly { key: K; label: string }[]
  value: K | null
  onChange: (key: K) => void
  size?: 'md' | 'sm' | 'wide'
  grid?: number
}) {
  const { options, value, onChange, size = 'md', grid } = props
  const name = useId()
  const pill = (o: { key: K; label: string }, inGrid: boolean) => {
    const on = value === o.key
    return (
      <label
        key={o.key}
        className={clsx(
          'cursor-pointer rounded-full border font-normal transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-orange-100',
          inGrid
            ? 'flex h-10 items-center justify-center whitespace-nowrap px-3 text-[13px] sm:flex-auto sm:px-2.5 sm:text-sm'
            : size === 'sm'
              ? 'px-3.5 py-[7px] text-[13px]'
              : 'py-[9px] text-sm',
          !inGrid && size === 'md' && 'px-4',
          !inGrid && size === 'wide' && 'px-[22px]',
          on
            ? 'border-orange-500 bg-orange-500 text-white'
            : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300'
        )}
      >
        <input
          type="radio"
          name={name}
          className="sr-only"
          checked={on}
          onChange={() => onChange(o.key)}
        />
        {o.label}
      </label>
    )
  }
  if (grid) {
    const rest = options.slice(grid)
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {options.slice(0, grid).map((o) => pill(o, true))}
        </div>
        {rest.length > 0 && (
          <div className="flex flex-wrap gap-2">{rest.map((o) => pill(o, false))}</div>
        )}
      </div>
    )
  }
  return <div className="flex flex-wrap gap-2">{options.map((o) => pill(o, false))}</div>
}

// Multi-select cards with a checkbox mark on the left.
export function CheckCard(props: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  sub?: ReactNode
}) {
  const { checked, onChange, label, sub } = props
  return (
    <label
      className={clsx(
        'flex w-full cursor-pointer gap-3 rounded-[10px] border px-3.5 py-3 text-left text-[15px] text-gray-900 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-orange-100',
        sub ? 'items-start' : 'items-center',
        checked
          ? 'border-orange-300 bg-orange-50'
          : 'border-gray-200 bg-white hover:border-orange-300'
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={clsx(
          'grid h-5 w-5 flex-none place-items-center rounded-md border-[1.5px]',
          !!sub && 'mt-px',
          checked ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'
        )}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={clsx('transition-opacity', checked ? 'opacity-100' : 'opacity-0')}
        >
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {sub ? (
        <span className="flex flex-col gap-0.5">
          <span>{label}</span>
          <span className="text-[13px] text-gray-500">{sub}</span>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </label>
  )
}

// Range input with the filled part of the track painted orange.
export function RangeInput(props: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  ariaLabel: string
}) {
  const { value, onChange, min = 0, max = 100, step = 1, ariaLabel } = props
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      type="range"
      className="range-orange w-full cursor-pointer"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ backgroundImage: `linear-gradient(to right, #f97316 ${pct}%, transparent ${pct}%)` }}
    />
  )
}
