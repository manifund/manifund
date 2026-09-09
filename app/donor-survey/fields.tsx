'use client'

import clsx from 'clsx'
import { ReactNode, useId } from 'react'

// Form primitives for the donor survey, following the Claude Design mockup:
// one 640px column, section headings with a hairline, pill single-selects,
// card-style multi-selects, and 44px inputs with an orange focus ring.

export function Section(props: {
  id?: string
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <section id={props.id} className="flex scroll-mt-16 flex-col gap-8">
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-3">
        <h2 className="bg-gradient-to-r from-orange-600 to-rose-500 bg-clip-text font-josefin text-[30px] font-[650] leading-none text-transparent">
          {props.title}
        </h2>
        {props.badge && (
          <span className="rounded-full bg-gray-100 px-2 py-[3px] text-xs text-gray-500">
            {props.badge}
          </span>
        )}
      </div>
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
  'w-full rounded-[10px] border border-gray-200 bg-white text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-500 focus:ring-[3px] focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-500'

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
export function Pills<K extends string>(props: {
  options: readonly { key: K; label: string }[]
  value: K | null
  onChange: (key: K) => void
  size?: 'md' | 'sm' | 'wide'
}) {
  const { options, value, onChange, size = 'md' } = props
  const name = useId()
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.key
        return (
          <label
            key={o.key}
            className={clsx(
              'cursor-pointer rounded-full border font-normal transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-orange-100',
              size === 'sm' ? 'px-3.5 py-[7px] text-[13px]' : 'py-[9px] text-sm',
              size === 'md' && 'px-4',
              size === 'wide' && 'px-[22px]',
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
      })}
    </div>
  )
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
