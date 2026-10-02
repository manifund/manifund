// Calling the running dev server as a test person: signs in through local Supabase Auth and sends
// the session cookie the app expects.
import { env } from './env'
import { getPeople, type Persona } from './fixtures'
import { sql } from './db'
import { RUN } from './content'

export type Res = { status: number; body: any }
export type Client = {
  id: string
  get(path: string): Promise<Res & { text: string }>
  post(path: string, body?: unknown): Promise<Res>
  patch(path: string, body?: unknown): Promise<Res>
  del(path: string, body?: unknown): Promise<Res>
}

const cookieName = `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`

const sessions = new Map<string, string>()

async function cookieForEmail(email: string) {
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

function client(id: string, cookie?: string): Client {
  return {
    id,
    get: (path) => call(cookie, 'GET', path),
    post: (path, body) => call(cookie, 'POST', path, body),
    patch: (path, body) => call(cookie, 'PATCH', path, body),
    del: (path, body) => call(cookie, 'DELETE', path, body),
  }
}

export async function as(who: Persona): Promise<Client> {
  const people = await getPeople()
  return client(people[who].id, await cookieForEmail(people[who].email))
}

// A throwaway account for this run (e.g. for rate-limit tests, which need a clean history).
// Created through local Supabase Auth's admin API; deleteTempUsers() removes it and its rows.
const temp: string[] = []
export async function tempUser(name: string): Promise<Client> {
  const email = `${RUN}-${name}@local.test`
  const res = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password: env.password, email_confirm: true }),
  })
  if (!res.ok) throw new Error(`creating ${email} failed: ${res.status} ${await res.text()}`)
  const { id } = (await res.json()) as { id: string }
  temp.push(id)
  // The sign-up trigger normally creates the profile; make sure it exists.
  await sql`insert into profiles (id, username, full_name) values (${id}, ${`${RUN}-${name}`}, ${'Test ' + name})
            on conflict (id) do nothing`
  return client(id, await cookieForEmail(email))
}
export async function deleteTempUsers() {
  for (const id of temp.splice(0)) {
    await sql`delete from comment_reports where reporter_id = ${id}`
    await sql`delete from comment_rxns where reactor_id = ${id}`
    await sql`delete from txns where from_id = ${id} or to_id = ${id}`
    await sql`delete from notifications where recipient_id = ${id} or actor_id = ${id}`
    await sql`delete from comments where commenter = ${id}`
    await sql`delete from project_follows where follower_id = ${id}`
    await sql`delete from profiles where id = ${id}`
    await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}` },
    })
  }
}
export const anonymous = () => client('')

// Fail fast with a clear message when the dev server isn't running.
export async function requireServer() {
  try {
    await fetch(`${env.baseUrl}/api/comments`, { method: 'POST', body: '{}' })
  } catch {
    throw new Error(`no dev server at ${env.baseUrl}: start it with local-dev/poc.sh up comments`)
  }
}
