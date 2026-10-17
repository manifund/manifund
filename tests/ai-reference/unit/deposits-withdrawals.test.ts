// Deposits and withdrawals, pure logic: docs/ai-reference/deposits-withdrawals/README.md, rules W15, W20.
import { describe, expect, test } from 'bun:test'
import { MERCURY_MIN_WITHDRAWAL, mercuryMinWithdrawal } from '@/utils/constants'
import { isManualWireCountry, type Recipient } from '@/utils/mercury'

describe('W15 the Mercury minimum: $1,000, or the whole balance when less', () => {
  test('$1,000 for anyone with at least that much', () => {
    expect(MERCURY_MIN_WITHDRAWAL).toBe(1000)
    expect(mercuryMinWithdrawal(1000)).toBe(1000)
    expect(mercuryMinWithdrawal(25_000)).toBe(1000)
  })
  test('below $1,000, the minimum is the whole balance, so nobody is locked out', () => {
    expect(mercuryMinWithdrawal(400)).toBe(400)
    expect(mercuryMinWithdrawal(0.5)).toBe(0.5)
  })

  // Open question "Withdrawing everything under $1,000 can be refused" (docs/ai-reference/deposits-withdrawals): the
  // route compares the amount (the form sends the balance floored to cents) with the minimum of the raw balance,
  // which can carry float dust. Turn on once the minimum comes from the balance in cents.
  test.skip('withdrawing the whole balance, as the form sends it, meets the minimum (balances with float dust)', () => {
    for (const rawBalance of [500.004, 499.9999999, 0.1 + 0.2 + 300]) {
      const formSends = Math.floor(rawBalance * 100) / 100 // withdraw-request-form.tsx
      const routeAmount = Math.round(formSends * 100) / 100 // mercury-withdraw/route.ts
      expect(routeAmount >= mercuryMinWithdrawal(rawBalance)).toBe(true)
    }
  })

})

describe('W20 wires to India and the Philippines go to a person', () => {
  const recipient = (r: Partial<Recipient>): Recipient => ({ id: 'r1', name: 'Test', status: 'active', ...r })
  test("by the recipient's address or the wire's bank address, in any case", () => {
    expect(isManualWireCountry(recipient({ address: { country: 'IN' } }))).toBe(true)
    expect(isManualWireCountry(recipient({ address: { country: 'ph' } }))).toBe(true)
    expect(
      isManualWireCountry(recipient({ internationalWireRoutingInfo: { address: { country: 'IN' } } }))
    ).toBe(true)
  })
  test('by the country-specific routing data when no address says', () => {
    expect(
      isManualWireCountry(recipient({ internationalWireRoutingInfo: { countrySpecific: { india: { ifsc: 'X' } } } }))
    ).toBe(true)
    expect(
      isManualWireCountry(recipient({ internationalWireRoutingInfo: { countrySpecific: { Philippines: {} } } }))
    ).toBe(true)
  })
  test('everyone else goes through the API', () => {
    expect(isManualWireCountry(recipient({ address: { country: 'US' } }))).toBe(false)
    expect(isManualWireCountry(recipient({ address: { country: 'GB' } }))).toBe(false)
    expect(isManualWireCountry(recipient({}))).toBe(false)
    expect(
      isManualWireCountry(recipient({ internationalWireRoutingInfo: { countrySpecific: { mexico: {} } } }))
    ).toBe(false)
  })
})
