// Admin tools' logic (docs/ai-reference/admin/README.md): who is an admin, the balance on /admin/users, and the
// addresses the /db shortcuts send to.
//
// `isAdmin` reads NODE_ENV and NEXT_PUBLIC_LOCAL_ADMIN_EMAILS once, when its module loads, so each build is checked
// in a child process with its own environment. The real admin list is read from the source at test time and never
// written here (docs/README.md: no personal data in the repo).
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { userBalances } from '@/app/admin/utils'
import { supabaseProfileRowUrl, supabaseProjectRowUrl } from '@/utils/supabase-admin-url'
import type { Txn } from '@/db/txn'

const root = join(import.meta.dir, '..', '..', '..')
const profileModule = join(root, 'db', 'profile.ts')

// isAdmin for each email (null = signed out, '' = an account without an email), in a build with this environment.
async function isAdminIn(env: { NODE_ENV: string; LOCAL?: string }, emails: (string | null)[]) {
  const code = `const { isAdmin } = await import(${JSON.stringify(profileModule)});
    console.log(JSON.stringify(${JSON.stringify(emails)}.map((e) => isAdmin(e === null ? null : { email: e }))))`
  const child = Bun.spawn(['bun', '--conditions', 'react-server', '-e', code], {
    cwd: root,
    // Set explicitly, so Bun's own loading of the checkout's .env files can't fill them in.
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      NODE_ENV: env.NODE_ENV,
      NEXT_PUBLIC_LOCAL_ADMIN_EMAILS: env.LOCAL ?? '',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err, code_] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code_ !== 0) throw new Error(`isAdmin child process failed: ${err}`)
  return JSON.parse(out.trim().split('\n').pop()!) as boolean[]
}

// The list as written in db/profile.ts.
function adminList(): string[] {
  const src = readFileSync(profileModule, 'utf8')
  const m = src.match(/const ADMINS = \[([^\]]*)\]/)
  if (!m)
    throw new Error(
      'the admin list moved: update M1 in docs/ai-reference/admin/README.md and this test'
    )
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

describe('M1 an admin is a signed-in person whose email is on the list in db/profile.ts', () => {
  test('every address on the list is an admin in a production build', async () => {
    const list = adminList()
    expect(list.length).toBeGreaterThan(0)
    expect(await isAdminIn({ NODE_ENV: 'production' }, list)).toEqual(list.map(() => true))
  })
  test('only an exact match: another address, a different case or extra spaces are not', async () => {
    const [first] = adminList()
    const result = await isAdminIn({ NODE_ENV: 'production' }, [
      'someone-else@example.test',
      first.toUpperCase(),
      ` ${first}`,
    ])
    expect(result).toEqual([false, false, false])
  })
  test('signed out, or an account without an email, is never an admin', async () => {
    expect(await isAdminIn({ NODE_ENV: 'production' }, [null, ''])).toEqual([false, false])
    // Even with blank entries in the local list, in development.
    expect(await isAdminIn({ NODE_ENV: 'development', LOCAL: ' , ,' }, [null, ''])).toEqual([
      false,
      false,
    ])
  })
})

describe('M2 local admins from NEXT_PUBLIC_LOCAL_ADMIN_EMAILS, in development builds only', () => {
  const LOCAL = ' tester-a@example.test , tester-b@example.test'
  test('in development, each address in the variable is an admin, spaces ignored', async () => {
    const r = await isAdminIn({ NODE_ENV: 'development', LOCAL }, [
      'tester-a@example.test',
      'tester-b@example.test',
      'tester-c@example.test',
    ])
    expect(r).toEqual([true, true, false])
  })
  test('production (and test) builds ignore the variable', async () => {
    for (const NODE_ENV of ['production', 'test']) {
      expect(await isAdminIn({ NODE_ENV, LOCAL }, ['tester-a@example.test'])).toEqual([false])
    }
  })
})

const txn = (from_id: string | null, to_id: string, amount: number) =>
  ({ from_id, to_id, amount }) as Txn

describe('M5 the balance on /admin/users: USD txns received minus sent', () => {
  test('received minus sent, per account; an account with no txns has none', () => {
    const b = userBalances([
      txn('bank', 'ann', 100),
      txn('ann', 'project-creator', 30),
      txn('ann', 'bank', 20), // a payout
      txn(null, 'bob', 5), // no sender (e.g. a minted amount)
    ])
    expect(b.get('ann')).toBe(50)
    expect(b.get('project-creator')).toBe(30)
    expect(b.get('bank')).toBe(-80)
    expect(b.get('bob')).toBe(5)
    expect(b.has('nobody')).toBe(false)
  })
})

describe('M15 M16 the /db shortcuts go to the row in Supabase’s table editor', () => {
  const id = '11111111-2222-3333-4444-555555555555'
  test('a profile: its row in the profiles table, filtered by id', () => {
    const url = new URL(supabaseProfileRowUrl(id))
    expect(url.origin).toBe('https://supabase.com')
    expect(url.pathname).toMatch(/^\/dashboard\/project\/[a-z]+\/editor\/\d+$/)
    expect(url.searchParams.get('filter')).toBe(`id:eq:${id}`)
  })
  test('a project: the same, in the projects table (another table id)', () => {
    const project = new URL(supabaseProjectRowUrl(id))
    const profile = new URL(supabaseProfileRowUrl(id))
    expect(project.searchParams.get('filter')).toBe(`id:eq:${id}`)
    expect(project.pathname).toMatch(/^\/dashboard\/project\/[a-z]+\/editor\/\d+$/)
    expect(project.pathname).not.toBe(profile.pathname)
    expect(project.pathname.split('/editor/')[0]).toBe(profile.pathname.split('/editor/')[0]) // same project
  })
})
