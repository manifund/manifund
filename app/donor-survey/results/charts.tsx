import clsx from 'clsx'
import { ReactNode } from 'react'
import type { Bar } from './aggregate'

// Server-rendered bar lists for the results page. Each bar carries its own
// count and share as text, so nothing depends on color alone.

export function Figure(props: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-col gap-1">
        <h3 className="text-lg font-medium leading-snug text-gray-900">{props.title}</h3>
        {props.note && <p className="text-sm text-gray-500">{props.note}</p>}
      </figcaption>
      {props.children}
    </figure>
  )
}

export function BarList(props: { bars: Bar[]; total: number; color?: string }) {
  const { bars, total, color = '#f97316' } = props
  const max = Math.max(1, ...bars.map((b) => b.count))
  return (
    <ol className="flex flex-col gap-2">
      {bars.map((b) => {
        const share = total ? Math.round((b.count / total) * 100) : 0
        return (
          <li
            key={b.key}
            className="grid grid-cols-[9.5rem_1fr_2rem_3rem] items-center gap-3 text-sm"
            title={`${b.label}: ${b.count} of ${total} (${share}%)`}
          >
            <span className="truncate text-gray-800">{b.label}</span>
            <span className="relative h-3 w-full rounded-r bg-gray-100">
              <span
                className="absolute inset-y-0 left-0 rounded-r"
                style={{
                  width: `${(b.count / max) * 100}%`,
                  backgroundColor: b.color ?? color,
                  minWidth: b.count > 0 ? 4 : 0,
                }}
              />
            </span>
            <span className="text-right tabular-nums text-gray-900">{b.count}</span>
            <span className="text-right tabular-nums text-gray-400">{share}%</span>
          </li>
        )
      })}
    </ol>
  )
}

export function PctList(props: {
  rows: { name: string; mean: number; color: string; custom: boolean }[]
}) {
  const max = Math.max(1, ...props.rows.map((r) => r.mean))
  return (
    <ol className="flex flex-col gap-2">
      {props.rows.map((r) => (
        <li
          key={r.name}
          className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-sm"
          title={`${r.name}: ${r.mean.toFixed(1)}% on average`}
        >
          <span
            className={clsx(
              'flex items-center gap-2 truncate',
              r.custom ? 'text-gray-600' : 'text-gray-800'
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="truncate">{r.name}</span>
          </span>
          <span className="relative h-3 w-full rounded-r bg-gray-100">
            <span
              className="absolute inset-y-0 left-0 rounded-r"
              style={{
                width: `${(r.mean / max) * 100}%`,
                backgroundColor: r.color,
                minWidth: r.mean > 0 ? 4 : 0,
              }}
            />
          </span>
          <span className="text-right tabular-nums text-gray-900">{Math.round(r.mean)}%</span>
        </li>
      ))}
    </ol>
  )
}

export function Stat(props: { value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-josefin text-4xl font-semibold tabular-nums leading-none text-gray-900">
        {props.value}
      </span>
      <span className="text-sm text-gray-700">{props.label}</span>
      {props.sub && <span className="text-xs text-gray-400">{props.sub}</span>}
    </div>
  )
}
