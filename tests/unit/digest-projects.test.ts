import { describe, expect, test } from 'bun:test'
import { FullProject } from '@/db/project'
import { isHighlyRatedStillRaising, selectNewProjects } from '@/utils/digest-projects'

const NOW = new Date('2026-10-19T17:00:00Z').getTime()
const daysAgo = (d: number) => new Date(NOW - d * 864e5).toISOString()

const project = (over: Partial<FullProject> = {}): FullProject =>
  ({
    id: Math.random().toString(),
    title: 'p',
    slug: 'p',
    stage: 'proposal',
    type: 'grant',
    created_at: daysAgo(2),
    karma: 2,
    min_funding: 1000,
    funding_goal: 5000,
    auction_close: '2026-11-30',
    ai_fraction: 0,
    project_ai_evals: [],
    project_votes: [],
    bids: [],
    txns: [],
    comments: [],
    ...over,
  }) as unknown as FullProject
const evals = (...scores: [number, number][]) =>
  scores.map(([score, d]) => ({ score, created_at: daysAgo(d) }))

describe('P10 new this week in the weekly digest', () => {
  test('needs karma plus the AI head start above 3', () => {
    expect(selectNewProjects([project({ project_ai_evals: evals([3, 1]) })], NOW)).toHaveLength(1)
    expect(selectNewProjects([project({ project_ai_evals: evals([2, 1]) })], NOW)).toHaveLength(0)
    expect(
      selectNewProjects([project({ karma: 10, project_ai_evals: evals([1, 1]) })], NOW)
    ).toHaveLength(1)
  })
  test('leaves out older, AI-written and already-featured projects', () => {
    const p = project({ project_ai_evals: evals([4, 1]) })
    expect(selectNewProjects([project({ created_at: daysAgo(8), karma: 50 })], NOW)).toHaveLength(0)
    expect(selectNewProjects([project({ karma: 50, ai_fraction: 1 })], NOW)).toHaveLength(0)
    expect(selectNewProjects([p], NOW, new Set([p.id]))).toHaveLength(0)
  })
  test('ranks by that value, highest first', () => {
    const low = project({ title: 'low', karma: 5 })
    const high = project({ title: 'high', project_ai_evals: evals([4, 1]) })
    expect(selectNewProjects([low, high], NOW).map((p) => p.title)).toEqual(['high', 'low'])
  })
})

describe('P10 featured projects in the weekly digest', () => {
  const rated = (over: Partial<FullProject> = {}) =>
    project({ created_at: daysAgo(20), project_ai_evals: evals([4, 20]), ...over })
  test('shows a 4-5 proposal below its minimum in the week it first qualifies', () => {
    expect(
      isHighlyRatedStillRaising(rated({ project_ai_evals: evals([3, 20], [4, 2]) }), NOW)
    ).toBe(true)
  })
  test('and again in the week before it closes', () => {
    expect(isHighlyRatedStillRaising(rated({ auction_close: '2026-10-24' }), NOW)).toBe(true)
  })
  test('but not in the weeks between', () => {
    expect(isHighlyRatedStillRaising(rated(), NOW)).toBe(false)
  })
  test('only while it is a proposal below its minimum, rated 4 or more', () => {
    const week = { auction_close: '2026-10-24' }
    expect(isHighlyRatedStillRaising(rated({ ...week, stage: 'active' }), NOW)).toBe(false)
    expect(
      isHighlyRatedStillRaising(rated({ ...week, project_ai_evals: evals([3, 20]) }), NOW)
    ).toBe(false)
    const funded = rated({
      ...week,
      bids: [{ amount: 1000, type: 'donate', status: 'pending' }] as any,
    })
    expect(isHighlyRatedStillRaising(funded, NOW)).toBe(false)
  })
})
