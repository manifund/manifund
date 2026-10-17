// Grant agreements (docs/ai-reference/agreements): the checks on an organization's details, the signing links' tokens,
// and the signer's IP address. Pure logic, no services. The documents themselves: tests/ai-reference/components/agreements.test.tsx.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { getAgreementBySigningTokenHash, parseOrgValues, requiresEin } from '@/db/grant_agreement'
import {
  SIGNING_TOKEN_TTL_DAYS,
  generateSigningToken,
  hashSigningToken,
  signingTokenExpiry,
} from '@/utils/signing-token'
import { clientIp } from '@/utils/grant-agreement-write'

const complete = {
  recipient_name: 'Example Foundation, Inc.',
  recipient_address: '1 Example Street, Springfield',
  recipient_country: 'United States',
  recipient_entity_class: 'us_501c3',
  recipient_tax_id: '00-0000000',
  foreign_no_tin: false,
  signatory_name: 'Sam Signer',
}

describe("A9 an organization's details are required, and checked by the server too", () => {
  test('complete details pass, trimmed', () => {
    const parsed = parseOrgValues({ ...complete, recipient_name: '  Example Foundation, Inc.  ' })
    expect(parsed).toEqual({ ...complete, recipient_entity_class: 'us_501c3' } as any)
  })
  test('each missing detail is refused with a message naming it', () => {
    const cases: [Partial<typeof complete>, string][] = [
      [{ recipient_name: ' ' }, 'legal name'],
      [{ recipient_address: '' }, 'registered address'],
      [{ recipient_country: '' }, 'country'],
      [{ recipient_entity_class: undefined as any }, 'entity type'],
      [{ recipient_tax_id: '' }, 'EIN'],
      [{ signatory_name: '' }, 'signatory'],
    ]
    for (const [patch, words] of cases) {
      const parsed = parseOrgValues({ ...complete, ...patch })
      expect('error' in parsed && parsed.error).toContain(words)
    }
    expect(parseOrgValues(null)).toEqual({ error: 'Missing recipient details.' })
    expect(parseOrgValues('a string')).toEqual({ error: 'Missing recipient details.' })
  })
  test('only the four known kinds of entity', () => {
    const parsed = parseOrgValues({ ...complete, recipient_entity_class: 'individual' })
    expect('error' in parsed && parsed.error).toContain('entity type')
  })
  test('a US entity needs an EIN; a non-US one an EIN or "no US taxpayer ID"', () => {
    for (const c of ['us_501c3', 'us_nonprofit_other', 'us_for_profit'] as const)
      expect(requiresEin(c)).toBe(true)
    expect(requiresEin('foreign_org')).toBe(false)
    const foreign = { ...complete, recipient_entity_class: 'foreign_org', recipient_tax_id: '' }
    expect('error' in parseOrgValues(foreign)).toBe(true)
    expect(parseOrgValues({ ...foreign, foreign_no_tin: true })).toMatchObject({
      recipient_tax_id: null,
      foreign_no_tin: true,
    })
    expect(parseOrgValues({ ...foreign, recipient_tax_id: '00-0000000' })).toMatchObject({
      recipient_tax_id: '00-0000000',
    })
    // A US entity can't skip the EIN with the foreign-only confirmation.
    expect(
      'error' in parseOrgValues({ ...complete, recipient_tax_id: '', foreign_no_tin: true })
    ).toBe(true)
  })
  test('fields of the wrong type count as missing; unknown fields are dropped', () => {
    const parsed = parseOrgValues({
      ...complete,
      signatory_name: 42,
      extra: 'x',
      foreign_no_tin: 'yes',
    })
    expect('error' in parsed && parsed.error).toContain('signatory')
    const ok = parseOrgValues({ ...complete, extra: 'x', foreign_no_tin: 'yes' })
    expect(ok).not.toHaveProperty('extra')
    expect(ok).toMatchObject({ foreign_no_tin: false })
  })
})

describe('A16 the signing link is the credential; only its hash is stored', () => {
  test('a token is 32 random bytes, base64url, different every time', () => {
    const a = generateSigningToken()
    const b = generateSigningToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(a, 'base64url')).toHaveLength(32)
    expect(a).not.toBe(b)
  })
  test("the stored hash is the token's SHA-256, in hex", async () => {
    const token = generateSigningToken()
    const hash = await hashSigningToken(token)
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(hash).not.toContain(token)
  })
})

describe('A15 a signing link is valid for 30 days', () => {
  test('the expiry is 30 days after sending', () => {
    expect(SIGNING_TOKEN_TTL_DAYS).toBe(30)
    const from = new Date('2026-01-01T00:00:00Z')
    expect(signingTokenExpiry(from)).toBe('2026-01-31T00:00:00.000Z')
  })
})

// A stand-in for the admin client's `grant_agreement_private` lookup by token hash.
const clientReturning = (data: unknown) =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => ({ throwOnError: async () => ({ data }) }) }),
      }),
    }),
  }) as any

describe('A18 an unknown or expired link finds nothing (the same answer for both)', () => {
  const row = { project_id: 'p', signing_token_hash: 'h', token_sent_to: 'signer@example.test' }
  test('unknown', async () => {
    expect(await getAgreementBySigningTokenHash(clientReturning(null), 'h')).toBeNull()
  })
  test('expired', async () => {
    const expired = { ...row, token_expires_at: new Date(Date.now() - 1000).toISOString() }
    expect(await getAgreementBySigningTokenHash(clientReturning(expired), 'h')).toBeNull()
  })
  test('still valid', async () => {
    const valid = { ...row, token_expires_at: new Date(Date.now() + 60_000).toISOString() }
    expect((await getAgreementBySigningTokenHash(clientReturning(valid), 'h')) as unknown).toEqual(
      valid
    )
  })
})

describe("A13 A19 the signer's IP address is the first one forwarded", () => {
  test('first of x-forwarded-for, else x-real-ip, else none', () => {
    const req = (h: Record<string, string>) => new Request('http://x', { headers: h })
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5')
    expect(clientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
    expect(clientIp(req({}))).toBeNull()
  })
})
