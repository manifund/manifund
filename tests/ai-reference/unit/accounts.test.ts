// Accounts and sign-in rules that are plain logic (docs/ai-reference/accounts/README.md). Bans run against a stand-in
// Supabase client that records what it's asked to do; nothing here reaches a database or another site.
import { describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { safeNext } from '@/utils/safe-next'
import { GET as sso } from '@/app/sso/route'
import { superbanUser } from '@/db/superban'
import { handleSpamProject } from '@/app/utils/spam-scores'

describe('S3 after signing in, only a path on this site', () => {
  test('a path on this site is kept, with its query', () => {
    expect(safeNext('/projects/x')).toBe('/projects/x')
    expect(safeNext('/sso?next=https%3A%2F%2Ftrace.manifund.org&then=%2F')).toBe(
      '/sso?next=https%3A%2F%2Ftrace.manifund.org&then=%2F'
    )
  })
  test('another site, a protocol-relative address or nothing lands on the home page', () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil', '', null, undefined]) {
      expect(safeNext(next)).toBe('/')
    }
  })
})

describe('S21 /sso hands sessions only to Trace', () => {
  // Refused before any session is read, so no Supabase client is needed.
  for (const next of [
    '',
    'https://evil.example/auth/handoff',
    'https://trace.manifund.org.evil.example/auth/handoff',
    'http://trace.manifund.org/auth/handoff',
    '/auth/handoff',
  ]) {
    test(`refuses next=${JSON.stringify(next)}`, async () => {
      const res = await sso(new NextRequest(`http://localhost:3000/sso?next=${encodeURIComponent(next)}`))
      expect(res.status).toBe(400)
    })
  }
})

// A stand-in for the service-role client: records each step of a ban.
function recorder(opts: { createdAt?: string | null; ageError?: boolean } = {}) {
  const steps: string[] = []
  const client: any = {
    from(table: string) {
      return {
        delete: () => ({
          eq: async (col: string, val: string) => {
            steps.push(`delete ${table} where ${col}=${val}`)
            return { error: null }
          },
        }),
        update: (fields: Record<string, unknown>) => ({
          eq: async (col: string, val: string) => {
            steps.push(`update ${table} ${JSON.stringify(fields)} where ${col}=${val}`)
            return { error: null }
          },
        }),
        upsert: async () => {
          steps.push(`upsert ${table}`)
          return { error: null }
        },
        // getUserEmail reads public.users: no address, so the spam notice isn't sent (no email from tests).
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          steps.push(`delete account ${id}`)
          return { error: null }
        },
        getUserById: async () =>
          opts.ageError
            ? { data: { user: null }, error: { message: 'unavailable' } }
            : { data: { user: { created_at: opts.createdAt } }, error: null },
      },
    },
  }
  return { client, steps }
}

const BAN_STEPS = (id: string) => [
  `delete projects where creator=${id}`,
  `delete comments where commenter=${id}`,
  `delete profiles where id=${id}`,
  `delete account ${id}`,
]

describe('S17 a ban deletes projects, comments, the profile, then the account', () => {
  test('in that order', async () => {
    const { client, steps } = recorder()
    await superbanUser(client, 'u1')
    expect(steps).toEqual(BAN_STEPS('u1'))
  })
})

describe('S19 the spam filter bans accounts under 7 days old, hides the project otherwise', () => {
  const project = { id: 'p1', title: 'Spam', slug: 'spam', creator: 'u1', description: null, blurb: null }
  const verdict = { is_spam: true, reason: 'pharmacy ad', model: 'test' } as any
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000).toISOString()
  const hide = `update projects {"stage":"hidden"} where id=p1`

  test('an account 2 days old is banned', async () => {
    const { client, steps } = recorder({ createdAt: daysAgo(2) })
    await handleSpamProject(client, project, verdict)
    expect(steps).toEqual(['upsert project_scores', ...BAN_STEPS('u1')])
  })
  test('an account 8 days old keeps its account; the project is hidden', async () => {
    const { client, steps } = recorder({ createdAt: daysAgo(8) })
    await handleSpamProject(client, project, verdict)
    expect(steps).toEqual(['upsert project_scores', hide])
  })
  test("when the account's age can't be read, the project is only hidden", async () => {
    const { client, steps } = recorder({ ageError: true })
    await handleSpamProject(client, project, verdict)
    expect(steps).toEqual(['upsert project_scores', hide])
  })
})
