import { describe, expect, test } from 'bun:test'
import { getTimelineSteps } from '@/app/projects/[slug]/project-timeline-steps'

const base = {
  projectSlug: 'aa-project',
  stage: 'proposal' as const,
  signedAgreement: false,
  approved: false,
  reachedMinFunding: false,
  minFunding: 5000,
  withdrawComplete: false,
}
const current = (props: typeof base) => getTimelineSteps(props).find((s) => !s.complete)?.name

describe("the creator's timeline", () => {
  test('steps come in the order agreed on 2026-10-12', () => {
    expect(getTimelineSteps(base).map((s) => s.name)).toEqual([
      'Publish your proposal',
      'Sign the grant agreement',
      'Spread the word and reach your minimum',
      'Manifund reviews your grant',
      'Withdraw your funds',
    ])
  })
  test('a published proposal asks for the signature first, telling the creator donations are open', () => {
    expect(current({ ...base, stage: 'draft' })).toBe('Publish your proposal')
    expect(current(base)).toBe('Sign the grant agreement')
    // Offers can reach the minimum before the agreement is signed.
    expect(current({ ...base, reachedMinFunding: true })).toBe('Sign the grant agreement')
    expect(getTimelineSteps(base)[1].details).toStartWith('Donations are open.')
  })
  test('spreading the word is a message only, with the minimum', () => {
    const step = getTimelineSteps(base)[2]
    expect(step.cta).toBeUndefined()
    expect(step.details).toContain('$5K')
  })
  test('the review waits on Manifund, then the withdraw step links to the withdraw page', () => {
    const signed = { ...base, signedAgreement: true, reachedMinFunding: true }
    expect(current(signed)).toBe('Manifund reviews your grant')
    const [, , , review, withdraw] = getTimelineSteps(signed)
    expect(review.nonAction).toBe(true)
    expect(review.cta).toBeUndefined()
    expect(current({ ...signed, stage: 'active', approved: true })).toBe('Withdraw your funds')
    expect(withdraw.cta?.href).toBe('/withdraw')
  })
})
