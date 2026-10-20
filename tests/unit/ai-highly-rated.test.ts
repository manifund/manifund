import { describe, expect, test } from 'bun:test'
import { isHighlyRatedByAi, latestAiEval } from '@/utils/karma'

const e = (score: number | null, created_at: string) => ({ score, created_at })

describe('P11 trophy and AI review for highly rated projects', () => {
  test('shown when the latest evaluation is 4 or 5', () => {
    expect(isHighlyRatedByAi([e(4, '2026-10-01')])).toBe(true)
    expect(isHighlyRatedByAi([e(5, '2026-10-01')])).toBe(true)
    expect(isHighlyRatedByAi([e(3, '2026-10-01')])).toBe(false)
    expect(isHighlyRatedByAi([])).toBe(false)
  })
  test('goes by the latest evaluation, skipping declined ones', () => {
    expect(isHighlyRatedByAi([e(4, '2026-10-01'), e(3, '2026-10-05')])).toBe(false)
    expect(isHighlyRatedByAi([e(4, '2026-10-01'), e(null, '2026-10-05')])).toBe(true)
    expect(latestAiEval([e(3, '2026-10-01'), e(4, '2026-10-05')])?.score).toBe(4)
  })
})
