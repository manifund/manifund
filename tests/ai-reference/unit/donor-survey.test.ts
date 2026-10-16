// The donor survey's pure logic (docs/ai-reference/donor-survey/README.md): which cause ratings are kept, the option
// lists the server checks answers against, and the results' tallies. Made-up rows only.
import { describe, expect, test } from 'bun:test'
import {
  CAPACITIES,
  CAUSES,
  GIVING_BANDS,
  GIVING_BANDS_2027,
  NOT_SURE_KEY,
  TOP_CAUSE_COUNT,
  fundsLabel,
  labelFor,
  parseCauseRatings,
} from '@/utils/donor-survey'
import { aggregate } from '@/app/donor-survey/results/aggregate'

describe('D2 D3 the option lists answers are checked against', () => {
  test('three capacities; six amount bands, plus "Not sure yet" for 2027 only', () => {
    expect(CAPACITIES.map((c) => c.key)).toEqual(['own_money', 'regrantor', 'grantmaker'])
    expect(GIVING_BANDS).toHaveLength(6)
    expect(GIVING_BANDS.some((b) => (b.key as string) === NOT_SURE_KEY)).toBe(false)
    expect(GIVING_BANDS_2027.map((b) => b.key)).toEqual([...GIVING_BANDS.map((b) => b.key), NOT_SURE_KEY])
  })
  test('an unknown key has no label', () => {
    expect(labelFor(GIVING_BANDS_2027, '5m_plus')).toBe('$5m+')
    expect(labelFor(GIVING_BANDS_2027, 'lots')).toBeNull()
    expect(labelFor(GIVING_BANDS_2027, null)).toBeNull()
  })
  test('funds vs. picking charities: named at the quarters, as a split in between', () => {
    expect(fundsLabel(0)).toBe('Everything through funds')
    expect(fundsLabel(100)).toBe('I pick every charity myself')
    expect(fundsLabel(35)).toBe('65% funds, 35% my own picks')
  })
})

describe('D4 cause ratings: whole ratings from 1 to 5, one per name', () => {
  test('nine causes, five shown first', () => {
    expect(CAUSES).toHaveLength(9)
    expect(TOP_CAUSE_COUNT).toBe(5)
  })
  test('keeps well-formed entries, trimmed', () => {
    expect(parseCauseRatings([{ name: ' AI safety ', rating: 5 }, { name: 'Shrimp', rating: 1 }])).toEqual([
      { name: 'AI safety', rating: 5 },
      { name: 'Shrimp', rating: 1 },
    ])
  })
  test('drops ratings outside 1-5 or not whole, and entries without a name', () => {
    const kept = parseCauseRatings([
      { name: 'A', rating: 0 },
      { name: 'B', rating: 6 },
      { name: 'C', rating: 2.5 },
      { name: 'D', rating: '3' },
      { name: '  ', rating: 3 },
      { rating: 3 },
      null,
      { name: 'E', rating: 3 },
    ])
    expect(kept).toEqual([{ name: 'E', rating: 3 }])
  })
  test('one entry per name, ignoring case: the first wins', () => {
    expect(parseCauseRatings([{ name: 'Progress', rating: 4 }, { name: 'progress', rating: 1 }])).toEqual([
      { name: 'Progress', rating: 4 },
    ])
  })
  test('names are cut at 80 characters; anything but a list is no ratings', () => {
    expect(parseCauseRatings([{ name: 'x'.repeat(100), rating: 2 }])[0].name).toHaveLength(80)
    expect(parseCauseRatings({ name: 'AI safety', rating: 5 })).toEqual([])
    expect(parseCauseRatings(null)).toEqual([])
  })
})

type Row = Parameters<typeof aggregate>[0][number]
const row = (r: Partial<Row>): Row => ({
  capacity: ['own_money'],
  giving_2026: 'under_50k',
  giving_2027: 'not_sure',
  cause_ratings: [],
  funds_vs_direct: null,
  hours_per_month: null,
  wants_opportunities: null,
  opportunity_frequency: null,
  wants_events: false,
  ...r,
})

describe('D13 the results are tallies of every response', () => {
  const rows = [
    row({
      capacity: ['own_money', 'regrantor'],
      giving_2026: '5m_plus',
      // Biosecurity comes first here, so only the tie-break puts AI safety ahead of it
      cause_ratings: [{ name: 'Biosecurity', rating: 4 }, { name: 'AI safety', rating: 5 }, { name: 'Progress', rating: 2 }],
      funds_vs_direct: 20,
      hours_per_month: '1_3',
      wants_opportunities: true,
      opportunity_frequency: 'monthly',
      wants_events: true,
    }),
    row({
      cause_ratings: [{ name: 'AI safety', rating: 3 }, { name: 'Shrimp', rating: 4 }],
      funds_vs_direct: 60,
      wants_opportunities: false,
      opportunity_frequency: 'weekly',
    }),
    row({ capacity: ['grantmaker'], cause_ratings: [{ name: 'Shrimp', rating: 5 }] }),
  ]
  const agg = aggregate(rows)
  const count = (bars: { key: string; count: number }[], key: string) => bars.find((b) => b.key === key)!.count

  test('amount bands per year, every band listed', () => {
    expect(agg.n).toBe(3)
    expect(agg.giving2026.map((b) => b.key)).toEqual(GIVING_BANDS.map((b) => b.key))
    expect(count(agg.giving2026, 'under_50k')).toBe(2)
    expect(count(agg.giving2026, '5m_plus')).toBe(1)
    expect(count(agg.giving2027, 'not_sure')).toBe(3)
  })
  test('per cause: how many gave each rating and the average, highest average first, then most ratings', () => {
    // Shrimp 4.5; AI safety and Biosecurity 4, AI safety rated by more people; Progress 2
    expect(agg.causes.map((c) => c.name)).toEqual(['Shrimp', 'AI safety', 'Biosecurity', 'Progress'])
    const ai = agg.causes.find((c) => c.name === 'AI safety')!
    expect(ai).toEqual({ name: 'AI safety', mean: 4, count: 2, dist: [0, 0, 1, 0, 1] })
  })
  test('funds vs. picking charities: the average of those who answered', () => {
    expect(agg.fundsMean).toBe(40)
    expect(aggregate([row({})]).fundsMean).toBeNull()
  })
  test('hours out of those who answered; capacities counted once per person who picked them', () => {
    expect(agg.hoursAnswered).toBe(1)
    expect(count(agg.hours, '1_3')).toBe(1)
    expect(count(agg.capacity, 'own_money')).toBe(2)
    expect(count(agg.capacity, 'regrantor')).toBe(1)
    expect(count(agg.capacity, 'grantmaker')).toBe(1)
  })
  test('opportunities by frequency count only people who want them; events', () => {
    expect(agg.wantsOpportunities).toBe(1)
    expect(count(agg.frequency, 'monthly')).toBe(1)
    expect(count(agg.frequency, 'weekly')).toBe(0) // the "no" answer's leftover frequency isn't counted
    expect(agg.wantsEvents).toBe(1)
  })
  test('no tallies of text answers, 1:1 calls or sharing choices', () => {
    expect(Object.keys(agg).sort()).toEqual(
      ['capacity', 'causes', 'frequency', 'fundsMean', 'giving2026', 'giving2027', 'hours', 'hoursAnswered', 'n', 'wantsEvents', 'wantsOpportunities'].sort()
    )
  })
})
