import clsx from 'clsx'
import { ReactNode } from 'react'
import { MAX_RATING } from '@/utils/donor-survey'
import type { Bar } from './aggregate'

// Server-rendered charts for the results page, in the design's style: a
// label column, a 10px track, and the value as text. Every chart uses the
// same label width so the tracks line up down the page; below sm the label
// sits on its own line above the track.

export function Figure(props: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-base font-medium text-gray-900">{props.title}</h3>
      {props.children}
      {props.note && <span className="text-xs text-gray-500">{props.note}</span>}
    </section>
  )
}

// `highlight`: the viewer's own answer(s), drawn in dark orange.
export function BarList(props: {
  bars: Bar[]
  total: number
  highlight?: string | string[] | null
}) {
  const { bars, total } = props
  const mine = new Set([props.highlight ?? []].flat())
  return (
    <div className="flex flex-col gap-3 sm:gap-2">
      {bars.map((b) => {
        const pct = total ? Math.round((b.count / total) * 100) : 0
        return (
          <BarRow
            key={b.key}
            label={b.label}
            fill={pct}
            value={`${pct}%`}
            title={`${b.label}: ${b.count} of ${total}`}
            strong={mine.has(b.key)}
            empty={b.count === 0}
          />
        )
      })}
    </div>
  )
}

const ROW =
  'grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[200px_1fr_auto]'

function BarRow(props: {
  label: string
  fill: number
  value: string
  title: string
  strong?: boolean
  empty?: boolean
}) {
  return (
    <div className={ROW} title={props.title}>
      <span
        className={clsx(
          'col-span-2 sm:col-span-1 sm:truncate',
          props.strong
            ? 'font-medium text-gray-900'
            : props.empty
              ? 'text-gray-300'
              : 'text-gray-500'
        )}
      >
        {props.label}
      </span>
      <div
        className={clsx(
          'h-2.5 overflow-hidden rounded-[5px]',
          props.empty ? 'bg-gray-50' : 'bg-gray-100'
        )}
      >
        <div
          className={clsx('h-full rounded-[5px]', props.strong ? 'bg-orange-500' : 'bg-orange-300')}
          style={{ width: `${props.fill}%` }}
        />
      </div>
      <span
        className={clsx(
          'w-10 text-right tabular-nums',
          props.empty ? 'text-gray-300' : 'text-gray-500'
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

// One shade per rating, from "not interested" (gray) to "very" (deep orange).
const SHADES = ['bg-gray-200', 'bg-orange-200', 'bg-orange-300', 'bg-orange-400', 'bg-orange-600']

// Interest per cause as the spread of ratings, not only the average: each bar
// is split by how many people gave each rating. The viewer's own rating is
// marked next to the average.
export function CauseSpread(props: {
  causes: { name: string; mean: number; count: number; dist: number[] }[]
  mine?: Record<string, number>
}) {
  if (props.causes.length === 0)
    return <span className="text-sm text-gray-500">Nobody has rated a cause yet.</span>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>Not interested</span>
        <span aria-hidden className="flex gap-0.5">
          {SHADES.map((shade, i) => (
            <span
              key={shade}
              className={clsx(
                'grid h-4 w-5 place-items-center rounded-[3px] text-[10px]',
                shade,
                i > 2 ? 'text-white' : 'text-gray-600'
              )}
            >
              {i + 1}
            </span>
          ))}
        </span>
        <span>Very</span>
      </div>
      <div className="flex flex-col gap-3 sm:gap-2">
        {props.causes.map((c) => {
          const you = props.mine?.[c.name]
          const spread = c.dist.map((n, i) => `${n}× ${i + 1}`).join(', ')
          return (
            <div
              key={c.name}
              className={ROW}
              title={`${c.name}: average ${c.mean.toFixed(1)} of ${MAX_RATING} from ${c.count} ${c.count === 1 ? 'rating' : 'ratings'} (${spread})`}
            >
              <span className="col-span-2 text-gray-500 sm:col-span-1 sm:truncate">{c.name}</span>
              <div className="flex h-3.5 overflow-hidden rounded-[4px]">
                {c.dist.map((n, i) =>
                  n ? (
                    <div
                      key={i}
                      className={clsx('border-r border-white last:border-0', SHADES[i])}
                      style={{ flex: n }}
                    />
                  ) : null
                )}
              </div>
              <span className="flex w-[86px] items-center justify-end gap-2 tabular-nums text-gray-500">
                {you ? (
                  <span
                    title="Your rating"
                    className="rounded-full bg-gray-900 px-1.5 text-[11px] leading-[18px] text-white"
                  >
                    you {you}
                  </span>
                ) : null}
                {c.mean.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The funds-vs-picks scale: a gradient track with the average as a circle and
// one person's answer as a line, each labelled on the track (the average
// above, the answer below; the answer above when there's no average). A label shifts by
// its own width in proportion to its position, so it stays within the track.
export function FundsScale(props: {
  average: number | null
  mine: number | null
  mineLabel?: string
}) {
  const { average, mine, mineLabel = 'you' } = props
  const at = (pct: number) => ({ left: `${pct}%`, transform: `translateX(-${pct}%)` })
  return (
    <div className="flex flex-col gap-1">
      <div
        className={clsx(
          'relative mt-7 h-2.5 rounded-[5px] bg-gradient-to-r from-orange-200 to-orange-500',
          average !== null && mine !== null && 'mb-5'
        )}
      >
        {average !== null && (
          <>
            <span
              className="absolute -top-6 whitespace-nowrap text-[11px] text-orange-700"
              style={at(average)}
            >
              avg {average}%
            </span>
            <div
              title="Average"
              className="absolute -top-1.5 h-[22px] w-[22px] -translate-x-1/2 rounded-full border-[3px] border-orange-600 bg-white"
              style={{ left: `${average}%` }}
            />
          </>
        )}
        {mine !== null && (
          <>
            <div
              title={mineLabel}
              className="absolute -top-2.5 h-[30px] w-0.5 -translate-x-1/2 bg-gray-900"
              style={{ left: `${mine}%` }}
            />
            <span
              className={clsx(
                'absolute whitespace-nowrap text-[11px] text-gray-700',
                // Above the track when it's free, so it can't meet the end labels.
                average === null ? '-top-6' : 'top-6'
              )}
              style={at(mine)}
            >
              {mineLabel}
            </span>
          </>
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>All funds</span>
        <span>All my own picks</span>
      </div>
    </div>
  )
}
