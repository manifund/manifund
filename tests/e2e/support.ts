// Helpers for browser tests. Playwright runs on Node, so this uses Supabase's REST API (with the
// local service key) instead of a direct database connection.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserContext } from '@playwright/test'

const file = join(__dirname, '..', '..', '.env.development.local')
const vars: Record<string, string> = {}
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) vars[m[1]] = m[2]
  }
}
const get = (k: string, d = '') => process.env[k] || vars[k] || d
const SUPABASE = get('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY')
const PASSWORD = get('TEST_PASSWORD', 'localpass123')
if (!/127\.0\.0\.1|localhost/.test(SUPABASE)) throw new Error('browser tests only run against a local Supabase')

export const RUN = `e2e-${Date.now().toString(36)}`
export const BASE = get('TEST_BASE_URL', `http://localhost:${get('PORT', '3002')}`)
export const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

// Supabase REST with the service key (bypasses row-level security): fixtures only.
export async function rest(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${SUPABASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function person(username: 'alice' | 'bob' | 'rita') {
  const [p] = await rest(`profiles?username=eq.${username}&select=id,username,full_name`)
  return p as { id: string; username: string; full_name: string }
}

async function session(email: string) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`sign-in as ${email} failed: ${res.status}`)
  return res.text()
}
const cookieName = `sb-${new URL(SUPABASE).hostname.split('.')[0]}-auth-token`

// Sign a browser context in as a test person (sets the session cookie the app reads).
export async function signIn(context: BrowserContext, username: 'alice' | 'bob' | 'rita') {
  const value = `base64-${Buffer.from(await session(`${username}@local.test`)).toString('base64url')}`
  await context.addCookies([{ name: cookieName, value, url: BASE }])
}

// Call the app's API as a test person (for setup steps that aren't what the test is about).
export async function api(username: 'alice' | 'bob' | 'rita', path: string, method: string, body?: unknown) {
  const cookie = `${cookieName}=base64-${Buffer.from(await session(`${username}@local.test`)).toString('base64url')}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// A project owned by alice and a program, for this run; teardown.ts deletes them.
export async function world() {
  const alice = await person('alice')
  const existing = await rest(`projects?slug=eq.${RUN}-p&select=id,slug`)
  const project =
    existing[0] ??
    (
      await rest('projects', 'POST', {
        title: `E2E project ${RUN}`,
        blurb: 'test',
        creator: alice.id,
        slug: `${RUN}-p`,
        stage: 'active',
        type: 'grant',
        min_funding: 100,
        funding_goal: 1000,
        founder_shares: 10000000,
        round: 'Regrants',
        description: doc('A test project.'),
      })
    )[0]
  const programSlug = `${RUN}-program`
  if (!(await rest(`causes?slug=eq.${programSlug}&select=slug`)).length) {
    // next/image only loads configured hosts: borrow an existing cause's header image.
    const [img] = await rest('causes?header_image_url=like.https*&select=header_image_url&limit=1')
    await rest('causes', 'POST', {
      title: `E2E program ${RUN}`,
      slug: programSlug,
      header_image_url: img?.header_image_url ?? '',
      prize: true,
      open: true,
    })
  }
  return { project: project as { id: string; slug: string }, program: programSlug, alice }
}
