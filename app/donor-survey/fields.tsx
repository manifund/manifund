'use client'

import clsx from 'clsx'
import { ReactNode, useId } from 'react'

// Form primitives for the donor survey. One column, no cards: a question is a
// label, an optional hint, the control, and an inline error when it applies.

export function Section(props: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-10">
      <h2 className="font-josefin text-3xl font-semibold text-gray-900">
        {props.title}
        {props.note && (
          <span className="ml-3 font-sans text-base font-normal text-gray-500">{props.note}</span>
        )}
      </h2>
      {props.children}
    </section>
  )
}

export function Question(props: {
  label: ReactNode
  hint?: ReactNode
  error?: string
  id?: string
  as?: 'fieldset' | 'div'
  children: ReactNode
}) {
  const { label, hint, error, id, as = 'div', children } = props
  // A single text control is wrapped in its <label>, so the association is
  // implicit. Groups of controls use a fieldset with a legend.
  const Wrapper = as === 'fieldset' ? 'fieldset' : 'label'
  const Title = as === 'fieldset' ? 'legend' : 'span'
  return (
    <Wrapper
      id={id}
      className={clsx('flex flex-col gap-3', as === 'fieldset' && 'min-w-0 border-0 p-0')}
    >
      <div className="flex flex-col gap-1">
        <Title className="text-lg font-medium leading-snug text-gray-900">{label}</Title>
        {hint && <span className="text-sm leading-relaxed text-gray-500">{hint}</span>}
      </div>
      {children}
      {error && (
        <span role="alert" className="text-sm text-rose-600">
          {error}
        </span>
      )}
    </Wrapper>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:bg-gray-50 disabled:text-gray-500'

export function TextField(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
  autoComplete?: string
  name?: string
}) {
  return (
    <input
      className={inputClass}
      type={props.type ?? 'text'}
      name={props.name}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      disabled={props.disabled}
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
      className={clsx(inputClass, 'min-h-[7rem] resize-y leading-relaxed')}
      rows={props.rows ?? 4}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
    />
  )
}

// Radio or checkbox rows that read as buttons. The native input stays in the
// tree (visually hidden) so keyboard and screen-reader behaviour is free.
export function Choices<K extends string>(props: {
  options: readonly { key: K; label: string }[]
  value: K[] | K | null
  onChange: (key: K) => void
  multiple?: boolean
  columns?: 1 | 2 | 3
}) {
  const { options, value, onChange, multiple, columns = 1 } = props
  const name = useId()
  const selected = (k: K) => (Array.isArray(value) ? value.includes(k) : value === k)
  return (
    <div
      className={clsx(
        'grid gap-2',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-3'
      )}
    >
      {options.map((o) => {
        const on = selected(o.key)
        return (
          <label
            key={o.key}
            className={clsx(
              'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-base transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500/40',
              on
                ? 'border-orange-500 bg-orange-50 text-gray-900'
                : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'
            )}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name}
              className="sr-only"
              checked={on}
              onChange={() => onChange(o.key)}
            />
            <span
              aria-hidden
              className={clsx(
                'flex h-5 w-5 shrink-0 items-center justify-center border transition-colors',
                multiple ? 'rounded' : 'rounded-full',
                on ? 'border-orange-500 bg-orange-500' : 'border-gray-400 bg-white'
              )}
            >
              {on && (
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-white stroke-[3]">
                  <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span>{o.label}</span>
          </label>
        )
      })}
    </div>
  )
}

export function CheckRow(props: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-800 transition-colors has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-500/40 hover:border-gray-400">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-400 text-orange-500 focus:ring-0 focus:ring-offset-0"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="leading-snug">{props.children}</span>
    </label>
  )
}
