// Who the ai-reference tests act as.
// - The shared test accounts (personas): alice, bob, rita @local.test, from the local stack. Several test files run
//   at once and other sessions use them too, so route tests only read through them. One exception: rita is the
//   admin (admins come from the server's environment), so she may moderate and give verdicts.
// - The file's own people (`person('name')`): throwaway accounts made for one test file and deleted after it. Use
//   them for anyone who posts, reacts, reports, follows or gets notified. Their rate-limit windows, balances and
//   notifications belong to that file alone.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from './db'
import { env } from './env'
import { RUN } from './content'
import { client, cookieForEmail, type Client } from './http'

export type Persona = 'alice' | 'bob' | 'rita'
export type People = Record<Persona, { id: string; email: string; username: string }>

let people: People | undefined
export async function getPeople(): Promise<People> {
  if (people) return people
  const rows = await sql`select p.id, u.email, p.username from profiles p join auth.users u on u.id = p.id
                         where u.email in ('alice@local.test', 'bob@local.test', 'rita@local.test')`
  const byName = Object.fromEntries(rows.map((r: any) => [r.username, r])) as People
  for (const name of ['alice', 'bob', 'rita'] as const) {
    if (!byName[name]) throw new Error(`test account ${name}@local.test is missing: run local-dev/reset.sh`)
  }
  people = byName
  return people
}

// Full profiles for the personas (bio, About, a project, donations), so pages look like real ones. Run once
// before a test run (routes/run.ts), not from each file: files run at the same time.
export async function applyPersonas() {
  await sql.unsafe(readFileSync(join(import.meta.dir, '..', 'fixtures', 'personas.sql'), 'utf8'))
}

// What a persona may send: nothing, except rita's admin actions (moderating a comment, closing reports, a verdict).
const ADMIN_ACTIONS = [/^PATCH \/api\/comments\/[^/]+$/, /^DELETE \/api\/comments\/[^/]+$/,
  /^POST \/api\/comments\/[^/]+\/resolve$/, /^POST \/api\/issue-grant-verdict$/]
function personaGuard(who: Persona) {
  return (method: string, path: string) => {
    const action = `${method} ${path.split('?')[0]}`
    if (who === 'rita' && ADMIN_ACTIONS.some((re) => re.test(action))) return
    throw new Error(
      `${who} is a shared test account: ${action} would change shared state. Use person('…') for someone who ` +
        `writes.`
    )
  }
}

// A persona, signed in, read-only (except rita's admin actions above).
export async function as(who: Persona): Promise<Client> {
  const p = (await getPeople())[who]
  return client(p.id, p.username, await cookieForEmail(p.email), personaGuard(who))
}

// A throwaway account for this file. Created through local Supabase Auth's admin API; deleteTempUsers() removes it
// and its rows at the end of the file.
const temp: string[] = []
export async function tempUser(name: string): Promise<Client> {
  const username = `${RUN}-${name}`
  const email = `${username}@local.test`
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
  // The sign-up trigger normally creates the profile; make sure it exists with this username.
  await sql`insert into profiles (id, username, full_name) values (${id}, ${username}, ${'Test ' + name})
            on conflict (id) do update set username = excluded.username, full_name = excluded.full_name`
  return client(id, username, await cookieForEmail(email))
}

// The file's own person called `name` (the same account each time it's asked for in this file).
const named = new Map<string, Promise<Client>>()
export function person(name: string): Promise<Client> {
  if (!named.has(name)) named.set(name, tempUser(name))
  return named.get(name)!
}

export async function deleteTempUsers() {
  for (const id of temp.splice(0)) {
    await sql`delete from comment_reports where reporter_id = ${id}`
    await sql`delete from comment_rxns where reactor_id = ${id}`
    await sql`delete from txns where from_id = ${id} or to_id = ${id}`
    await sql`delete from notifications where recipient_id = ${id} or actor_id = ${id}`
    await sql`delete from comments where commenter = ${id}`
    await sql`delete from project_follows where follower_id = ${id}`
    await sql`delete from bids where bidder = ${id}`
    await sql`delete from profiles where id = ${id}`
    await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}` },
    })
  }
  named.clear()
}
