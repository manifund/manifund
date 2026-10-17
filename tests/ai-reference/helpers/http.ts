// Calling the running dev server: a client sends the session cookie the app expects. Who the client is
// (a test person or a visitor) comes from people.ts.
import { env } from './env'

export type Res = { status: number; body: any }
export type Client = {
  id: string
  username: string
  get(path: string): Promise<Res & { text: string }>
  post(path: string, body?: unknown): Promise<Res & { text: string }>
  patch(path: string, body?: unknown): Promise<Res & { text: string }>
  del(path: string, body?: unknown): Promise<Res & { text: string }>
}

const cookieName = `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`
const sessions = new Map<string, string>()

// Signs in through local Supabase Auth (once per email per file).
export async function cookieForEmail(email: string) {
  if (sessions.has(email)) return sessions.get(email)!
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: env.password }),
  })
  if (!res.ok) throw new Error(`sign-in as ${email} failed: ${res.status} ${await res.text()}`)
  const session = await res.text()
  const cookie = `${cookieName}=base64-${Buffer.from(session).toString('base64url')}`
  sessions.set(email, cookie)
  return cookie
}

async function call(cookie: string | undefined, method: string, path: string, body?: unknown) {
  const res = await fetch(`${env.baseUrl}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  return { status: res.status, body: json, text }
}

// `guard` may refuse a write before it is sent (see people.ts: the shared accounts are read-only).
export function client(
  id: string,
  username: string,
  cookie?: string,
  guard?: (method: string, path: string) => void
): Client {
  const write = (method: string) => (path: string, body?: unknown) => {
    guard?.(method, path)
    return call(cookie, method, path, body)
  }
  return {
    id,
    username,
    get: (path) => call(cookie, 'GET', path),
    post: write('POST'),
    patch: write('PATCH'),
    del: write('DELETE'),
  }
}

export const anonymous = () => client('', '')

// Fail fast with a clear message when the dev server isn't running.
export async function requireServer() {
  try {
    await fetch(`${env.baseUrl}/api/comments`, { method: 'POST', body: '{}' })
  } catch {
    throw new Error(`no dev server at ${env.baseUrl}: start it with local-dev/poc.sh up comments`)
  }
}
