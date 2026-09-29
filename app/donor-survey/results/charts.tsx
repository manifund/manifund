import clsx from 'clsx'
import { ReactNode } from 'react'
import { MAX_RATING } from '@/utils/donor-survey'
import type { Bar } from './aggregate'

// Server-rendered bar lists for the results page, in the design's style: a
// label column, a 10px track, and the share as text.

export function Figure(props: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-base font-medium text-gray-900">{props.title}</h3>
      {props.children}
      {props.note && <span className="text-xs text-gray-400">{props.note}</span>}
    </section>
  )
}

// With `stack`, the label sits on its own line above the track below sm, so
// long labels don't squeeze the bar on a phone.
export function BarList(props: {
  bars: Bar[]
  total: number
  highlight?: string | null
  labelWidth?: string
  stack?: boolean
}) {
  const { bars, total, highlight = null, labelWidth = '110px', stack } = props
  return (
    <div className={clsx('flex flex-col', stack ? 'gap-3 sm:gap-2' : 'gap-2')}>
      {bars.map((b) => {
        const pct = total ? Math.round((b.count / total) * 100) : 0
        const mine = highlight !== null && b.key === highlight
        return (
          <BarRow
            key={b.key}
            label={b.label}
            labelWidth={labelWidth}
            fill={pct}
            value={`${pct}%`}
            title={`${b.label}: ${b.count} of ${total}`}
            strong={mine}
            stack={stack}
          />
        )
      })}
    </div>
  )
}

export function CauseRatingList(props: {
  causes: { name: string; mean: number; count: number }[]
}) {
  if (props.causes.length === 0)
    return <span className="text-sm text-gray-500">Nobody has rated a cause yet.</span>
  return (
    <div className="flex flex-col gap-3 sm:gap-2">
      {props.causes.map((c) => (
        <BarRow
          key={c.name}
          label={c.name}
          labelWidth="190px"
          fill={(c.mean / MAX_RATING) * 100}
          value={c.mean.toFixed(1)}
          stack
          title={`${c.name}: ${c.mean.toFixed(1)} of ${MAX_RATING}, from ${c.count} ${c.count === 1 ? 'rating' : 'ratings'}`}
        />
      ))}
    </div>
  )
}

function BarRow(props: {
  label: string
  labelWidth: string
  fill: number
  value: string
  title: string
  strong?: boolean
  stack?: boolean
}) {
  return (
    <div
      className={clsx(
        'grid items-center gap-x-3 gap-y-1 text-sm',
        props.stack
          ? 'grid-cols-[1fr_40px] sm:grid-cols-[var(--label-w)_1fr_40px]'
          : 'grid-cols-[var(--label-w)_1fr_40px]'
      )}
      style={{ '--label-w': props.labelWidth } as React.CSSProperties}
      title={props.title}
    >
      <span
        className={clsx(
          props.stack ? 'col-span-2 sm:col-span-1 sm:truncate' : 'truncate',
          props.strong ? 'font-medium text-gray-900' : 'text-gray-500'
        )}
      >
        {props.label}
      </span>
      <div className="h-2.5 overflow-hidden rounded-[5px] bg-gray-100">
        <div
          className={clsx('h-full rounded-[5px]', props.strong ? 'bg-orange-500' : 'bg-orange-300')}
          style={{ width: `${props.fill}%` }}
        />
      </div>
      <span className="text-right tabular-nums text-gray-500">{props.value}</span>
    </div>
  )
}

// The funds-vs-picks scale: a gradient track with the average as a circle and
// the viewer's own answer as a line.
export function FundsScale(props: { average: number | null; mine: number | null }) {
  const { average, mine } = props
  return (
    <div className="flex flex-col gap-1">
      <div className="relative mb-1 mt-4 h-2.5 rounded-[5px] bg-gradient-to-r from-orange-200 to-orange-500">
        {average !== null && (
          <div
            title="Average"
            className="absolute -top-1.5 h-[22px] w-[22px] -translate-x-1/2 rounded-full border-[3px] border-orange-600 bg-white"
            style={{ left: `${average}%` }}
          />
        )}
        {mine !== null && (
          <div
            title="You"
            className="absolute -top-2.5 h-[30px] w-0.5 -translate-x-1/2 bg-gray-900"
            style={{ left: `${mine}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>All funds</span>
        <span>All my own picks</span>
      </div>
    </div>
  )
}
