import clsx from 'clsx'
import { ReactNode } from 'react'
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

export function BarList(props: {
  bars: Bar[]
  total: number
  highlight?: string | null
  labelWidth?: string
}) {
  const { bars, total, highlight = null, labelWidth = '110px' } = props
  return (
    <div className="flex flex-col gap-2">
      {bars.map((b) => {
        const pct = total ? Math.round((b.count / total) * 100) : 0
        const mine = highlight !== null && b.key === highlight
        return (
          <div
            key={b.key}
            className="grid items-center gap-3 text-sm"
            style={{ gridTemplateColumns: `${labelWidth} 1fr 40px` }}
            title={`${b.label}: ${b.count} of ${total}`}
          >
            <span
              className={clsx('truncate', mine ? 'font-medium text-gray-900' : 'text-gray-500')}
            >
              {b.label}
            </span>
            <div className="h-2.5 overflow-hidden rounded-[5px] bg-gray-100">
              <div
                className="h-full rounded-[5px]"
                style={{
                  width: `${pct}%`,
                  backgroundColor: b.color ?? (mine ? '#f97316' : '#fdba74'),
                }}
              />
            </div>
            <span className="text-right tabular-nums text-gray-500">{pct}%</span>
          </div>
        )
      })}
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
