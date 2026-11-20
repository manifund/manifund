import { describe, expect, test } from 'bun:test'
import { grantAmounts } from '@/tools/autograntor/lib'
import { compareLedgers, parseLedger, simulateSize } from '@/tools/autograntor/simulate'

const HEADER = 'name,size,kind,weight,p1,p0,ev,p10,p90,exec,exec_mode,group,post2030,note'
const ledger = (...rows: string[]) => parseLedger([HEADER, ...rows].join('\n'))

describe('P15: grant amounts', () => {
  test('min, goal and $10k when strictly between', () => {
    expect(grantAmounts(5000, 50000)).toEqual([5000, 10000, 50000])
  })
  test('no $10k at a bound or outside the range', () => {
    expect(grantAmounts(10000, 50000)).toEqual([10000, 50000])
    expect(grantAmounts(2000, 10000)).toEqual([2000, 10000])
    expect(grantAmounts(1000, 8000)).toEqual([1000, 8000])
    expect(grantAmounts(20000, 80000)).toEqual([20000, 80000])
  })
  test('one amount when min equals goal', () => {
    expect(grantAmounts(25000, 25000)).toEqual([25000])
  })
})

describe('ledger simulator', () => {
  const l = ledger(
    'team,,exec,,,,0.6,0.3,0.85,,,,,',
    'paper,10000,event,1000,0.5,0.1,,,,team,credit,research,0,',
    'law,10000,event,2000,0.2,0.1,,,,team,p1,policy,0.5,',
    'audience,10000,continuous,,,,30,10,80,team,,audience,0,',
    'hype,10000,charge,,,,-20,-60,-5,,,exposure,0,',
    'noise,10000,continuous,,,,5,-10,20,,,other,0,'
  )

  test('analytic mean matches hand calculation', () => {
    const r = simulateSize(l, 10000, 1000)
    const expected =
      1000 * 0.6 * (0.5 - 0.1) + // credit: whole increment scales
      2000 * (0.6 * 0.2 - 0.1) + // p1: only the with-grant probability scales
      30 * 0.6 + // continuous program row scales
      -20 + // charge never scales
      5
    expect(r.mean).toBeCloseTo(expected, 6)
    expect(r.groups.exposure).toBe(-20)
    expect(r.post2030_share).toBeCloseTo((2000 * (0.6 * 0.2 - 0.1) * 0.5) / expected, 6)
  })

  test('Monte Carlo mean is within 1% of the analytic mean', () => {
    const r = simulateSize(l, 10000, 200_000)
    expect(Math.abs(r.mc_mean - r.mean) / Math.abs(r.mean)).toBeLessThan(0.01)
    expect(r.p10).toBeLessThan(r.median)
    expect(r.median).toBeLessThan(r.p90)
  })

  test('rejects bad rows', () => {
    expect(() =>
      ledger('x,10000,charge,,,,-5,,,team,,money,0,', 'team,,exec,,,,0.5,0.2,0.8,,,,,')
    ).toThrow(/charges never take/)
    expect(() => ledger('x,10000,event,100,0.5,0.1,,,,,,nonsense,0,')).toThrow(/group must be/)
    expect(() => ledger('x,10000,event,100,0.5,0.1,,,,crew,credit,research,0,')).toThrow(
      /no exec row/
    )
  })

  test('diff agrees on close ledgers and diverges on different ones', () => {
    const a = ledger('r,10000,event,1000,0.3,0.1,,,,,,research,0,')
    const close = ledger('s,10000,event,1000,0.32,0.1,,,,,,research,0,')
    const far = ledger('t,10000,continuous,,,,600,100,1500,,,audience,0,')
    expect(compareLedgers(a, close, 10000).agree).toBe(true)
    expect(compareLedgers(a, far, 10000).agree).toBe(false)
  })
})
