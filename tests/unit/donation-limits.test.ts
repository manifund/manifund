// The limits on giving to a grant project, shared by the donate boxes and the routes (utils/donation-limits.ts).
// Local, no services needed.
import { describe, expect, test } from 'bun:test'
import { donationLimitError, fundingLeft, MIN_DONATION } from '@/utils/donation-limits'

describe('the limits on giving to a grant project (shared by the donate boxes and the routes)', () => {
  test('what is left of the goal is the goal minus what was raised, never negative', () => {
    expect(fundingLeft(1000, 250)).toBe(750)
    expect(fundingLeft(1000, 1200)).toBe(0)
    expect(fundingLeft(100, 33.333)).toBe(66.67)
  })
  test('from $10 up to what is left', () => {
    expect(MIN_DONATION).toBe(10)
    expect(donationLimitError(10, 750)).toBeNull()
    expect(donationLimitError(750, 750)).toBeNull()
    expect(donationLimitError(9.99, 750)).toBe('The minimum is $10.')
    expect(donationLimitError(751, 750)).toBe(
      'This project needs $750 more to reach its funding goal, so you can give up to $750.'
    )
  })
  test('with less than $10 left, exactly what is left is allowed', () => {
    expect(donationLimitError(4.5, 4.5)).toBeNull()
    expect(donationLimitError(4, 4.5)).toBe(
      "The minimum is $4.50, what's left of the funding goal."
    )
    expect(donationLimitError(10, 4.5)).not.toBeNull()
  })
  test('nothing once the goal is reached', () => {
    expect(donationLimitError(10, 0)).toBe(
      'This project has reached its funding goal and is not accepting more donations.'
    )
  })
  test('no goal (a person or a fund): only the minimum', () => {
    expect(donationLimitError(1_000_000, null)).toBeNull()
    expect(donationLimitError(5, null)).toBe('The minimum is $10.')
  })
})
