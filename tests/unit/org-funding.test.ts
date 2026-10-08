import { describe, expect, test } from 'bun:test'
import { formatCompactMoney, summarizeFunding } from '@/utils/org-funding'

const grant = (funder: string, amountUsd: number | null, date: string | null) => ({
  amountUsd,
  date,
  funderSlug: funder.toLowerCase().replace(/\W+/g, '-'),
  funderName: funder,
})

describe('O4 funding totals are a plain sum of the grants Trace has', () => {
  test('sums every grant with an amount, dated or not', () => {
    const funding = summarizeFunding(
      [grant('A', 100, '2024-01-01'), grant('B', 50, null), grant('C', null, '2025-01-01')],
      2026
    )
    expect(funding.total).toBe(150)
    expect(funding.grantCount).toBe(3)
  })
  test('years run without gaps and the current year is marked year to date', () => {
    const funding = summarizeFunding([grant('A', 1, '2024-03-01'), grant('A', 2, '2026-02-01')], 2026)
    expect(funding.years.map((y) => y.label)).toEqual(['2024', '2025', '2026 YTD'])
    expect(funding.years.map((y) => y.total)).toEqual([1, 0, 2])
  })
  test('the four largest funders are named; the rest share one series', () => {
    const grants = ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => grant(name, 100 - i, '2025-01-01'))
    const { series } = summarizeFunding(grants, 2026)
    expect(series.map((s) => s.name)).toEqual(['A', 'B', 'C', 'D', '2 other funders'])
    expect(series[4].total).toBe(96 + 95)
  })
  test("Trace's placeholder rows count in the total but are never a named funder", () => {
    const { series, total } = summarizeFunding(
      [grant('Unknown Donors', 900, '2025-01-01'), grant('A', 100, '2025-01-01')],
      2026
    )
    expect(total).toBe(1000)
    expect(series.map((s) => s.name)).toEqual(['A', 'Undisclosed donors'])
  })
})

describe('compact money', () => {
  test('rounds to the unit people say', () => {
    expect(formatCompactMoney(48_200_000)).toBe('$48.2M')
    expect(formatCompactMoney(650_000)).toBe('$650K')
    expect(formatCompactMoney(900)).toBe('$900')
  })
})
