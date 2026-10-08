'use client'
import { useState } from 'react'
import { formatCompactMoney, type FundingSummary } from '@/utils/org-funding'

const BAR_HEIGHT = 170

// Grants by year, stacked by funder, with the hovered year's breakdown beside it; then every series
// over all time.
export function Funding(props: { funding: FundingSummary }) {
  const { funding } = props
  const { years, series } = funding
  const [selected, setSelected] = useState(years[years.length - 1]?.year)
  // With many bars the amounts above them collide: only the selected year keeps its own.
  const crowded = years.length > 6
  const max = Math.max(...years.map((year) => year.total), 1)
  const detail = years.find((year) => year.year === selected)
  const seriesByKey = Object.fromEntries(series.map((s) => [s.key, s]))
  const top = Math.max(...series.map((s) => s.total), 1)

  return (
    <div>
      {years.length > 0 && (
        <div className="flex flex-wrap items-end gap-8">
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="flex h-[200px] items-end gap-3 border-b border-gray-200">
              {years.map((year) => (
                <button
                  key={year.year}
                  type="button"
                  aria-label={`${year.label}: ${formatCompactMoney(year.total)}`}
                  aria-pressed={year.year === selected}
                  onMouseEnter={() => setSelected(year.year)}
                  onFocus={() => setSelected(year.year)}
                  onClick={() => setSelected(year.year)}
                  className={`flex h-full min-w-0 flex-1 cursor-default flex-col items-stretch justify-end transition-opacity ${
                    year.year === selected ? 'opacity-100' : 'opacity-55'
                  }`}
                >
                  <div className="mb-1 whitespace-nowrap text-center text-[11px] text-gray-500">
                    {year.total > 0 && (!crowded || year.year === selected)
                      ? formatCompactMoney(year.total)
                      : ''}
                  </div>
                  <div className="flex flex-col-reverse overflow-hidden rounded-t-[3px]">
                    {year.segments.map((segment) => (
                      <div
                        key={segment.key}
                        style={{
                          height: Math.max(2, (segment.amount / max) * BAR_HEIGHT),
                          background: seriesByKey[segment.key].color,
                        }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-3">
              {years.map((year) => (
                <div
                  key={year.year}
                  className="min-w-0 flex-1 truncate text-center text-xs text-gray-500"
                >
                  {crowded ? `’${String(year.year).slice(2)}` : year.label}
                </div>
              ))}
            </div>
          </div>
          {detail && (
            <div className="min-w-[200px] flex-[0_1_240px]">
              <div className="text-xs text-gray-500">{detail.label} total</div>
              <div className="mt-0.5 text-[28px] font-normal text-gray-900">
                {formatCompactMoney(detail.total)}
              </div>
              <div className="mt-3.5 flex flex-col gap-2">
                {detail.segments.map((segment) => (
                  <div key={segment.key} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-sm"
                      style={{ background: seriesByKey[segment.key].color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-gray-700">
                      {seriesByKey[segment.key].name}
                    </span>
                    <span className="font-normal tabular-nums text-gray-900">
                      {formatCompactMoney(segment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-7 border-t border-gray-200 pt-5">
        <h3 className="mb-3 text-sm font-medium text-gray-900">Largest funders, all time</h3>
        <div className="flex flex-col gap-2.5">
          {series.map((s) => (
            <div
              key={s.key}
              className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_72px_44px] items-center gap-3 text-[13px]"
            >
              <span className="truncate text-gray-700">{s.name}</span>
              <div className="h-2 overflow-hidden rounded bg-gray-200">
                <div
                  className="h-full rounded"
                  style={{ width: `${(s.total / top) * 100}%`, background: s.color }}
                />
              </div>
              <span className="text-right font-normal tabular-nums text-gray-900">
                {formatCompactMoney(s.total)}
              </span>
              <span className="text-right tabular-nums text-gray-400">
                {Math.round((s.total / funding.total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
