// Grants sent to an email (db/project-transfer.ts): a sign-up claims them, and a grant to an email that already
// has an account goes to that account. Pure logic: an in-memory stand-in for the Supabase client, no database.
import { describe, expect, test } from 'bun:test'
import { getAccountIdByEmail, getTransfersByEmail, normalizeEmail } from '@/db/project-transfer'

// eq is exact; ilike ignores case and, like Postgres, reads _ and % as wildcards.
const ilikeMatches = (value: string, pattern: string) => {
  const re = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/_/g, '.')
    .replace(/%/g, '.*')
  return new RegExp(`^${re}$`, 'i').test(value)
}
const fakeClient = (rows: Record<string, unknown>[]) => {
  const query = (list: Record<string, unknown>[]): any => ({
    select: () => query(list),
    eq: (col: string, v: unknown) => query(list.filter((r) => r[col] === v)),
    ilike: (col: string, v: string) => query(list.filter((r) => ilikeMatches(String(r[col]), v))),
    limit: (n: number) => query(list.slice(0, n)),
    then: (resolve: (r: unknown) => unknown) => resolve({ data: list, error: null }),
  })
  return { from: () => query(rows) } as any
}

describe('a sign-up claims the grants sent to its email', () => {
  test('a transfer to the same email is found', async () => {
    const found = await getTransfersByEmail(
      fakeClient([{ recipient_email: 'new@example.org' }]),
      'new@example.org'
    )
    expect(found).toHaveLength(1)
  })
  // Sign-up stores emails in lowercase; older transfers keep the email as the regrantor typed it.
  test('a transfer sent to an email with capitals is found for the same email in lowercase', async () => {
    const found = await getTransfersByEmail(
      fakeClient([{ recipient_email: 'New@Example.org' }]),
      'new@example.org'
    )
    expect(found).toHaveLength(1)
  })
  test('only the same email matches: _ in an email is not a wildcard, and no email matches nothing', async () => {
    const rows = [{ recipient_email: 'a_b@example.org' }, { recipient_email: 'axb@example.org' }]
    const found = await getTransfersByEmail(fakeClient(rows), 'a_b@example.org')
    expect(found.map((t) => t.recipient_email)).toEqual(['a_b@example.org'])
    expect(await getTransfersByEmail(fakeClient(rows), '')).toHaveLength(0)
  })
})

describe('a grant to the email of an existing account goes to that account', () => {
  test('emails are compared trimmed and in lowercase', () => {
    expect(normalizeEmail('  New@Example.ORG ')).toBe('new@example.org')
  })
  test('the account is found whatever the case typed', async () => {
    const users = fakeClient([{ id: 'u1', email: 'new@example.org' }])
    expect(await getAccountIdByEmail(users, 'New@Example.org')).toBe('u1')
  })
  test('no account for an unknown or empty email', async () => {
    const users = fakeClient([{ id: 'u1', email: 'new@example.org' }])
    expect(await getAccountIdByEmail(users, 'other@example.org')).toBeNull()
    expect(await getAccountIdByEmail(users, ' ')).toBeNull()
  })
})
