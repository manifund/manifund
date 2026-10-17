// Accounts and sign-in through the dev server (docs/ai-reference/accounts/README.md): email links at /auth/callback,
// bans, and the session handoff to Trace. Redirects are read, never followed: nothing here contacts Trace or Google
// (email links are made by the local Supabase Auth's admin API, which sends no email).
//
// Rita's ban (S16) goes through a local unguarded client: her shared client allows only the admin actions in
// tests/ai-reference/helpers/people.ts, and banning isn't one of them. She bans only this file's throwaway person, which changes
// none of her own rows.
import { beforeAll, describe, expect } from 'bun:test'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { anonymous, client, cookieForEmail, type Client } from '../helpers/http'
import { getPeople, person } from '../helpers/people'
import { makeProject } from '../helpers/fixtures'
import { doc, RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

const emailOf = (name: string) => `${RUN}-${name}@local.test` // as tests/ai-reference/helpers/people.ts makes them

// A GET that doesn't follow redirects, keeping the headers.
async function raw(path: string, cookie?: string) {
  const res = await fetch(`${env.baseUrl}${path}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  })
  await res.text()
  return {
    status: res.status,
    location: res.headers.get('location') ?? '',
    setCookie: res.headers.getSetCookie(),
  }
}

// A one-time email link's token_hash, from local Supabase Auth (the admin API makes the link; no email goes out).
async function tokenHash(type: 'recovery' | 'magiclink', email: string) {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ type, email }),
  })
  if (!res.ok) throw new Error(`generate_link failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as any
  return (body.hashed_token ?? body.properties?.hashed_token) as string
}

let reader: Client
beforeAll(async () => {
  reader = await person('reader')
})

describe('S13 email links at /auth/callback', () => {
  smoke(
    'a reset link works without the browser that asked for it: signed in, on to the new-password page',
    async () => {
      const hash = await tokenHash('recovery', emailOf('reader'))
      const r = await raw(
        `/auth/callback?token_hash=${hash}&type=recovery&next=${encodeURIComponent('/edit-profile/reset-password')}`
      )
      expect(r.status).toBe(307)
      expect(new URL(r.location).pathname).toBe('/edit-profile/reset-password')
      expect(r.setCookie.some((c) => c.includes('-auth-token') && !/max-age=0/i.test(c))).toBe(true)
    }
  )
  standard(
    'a link is used once: the second time it brings the person to /login with the reason',
    async () => {
      const hash = await tokenHash('magiclink', emailOf('reader'))
      expect((await raw(`/auth/callback?token_hash=${hash}&type=magiclink`)).status).toBe(307)
      const again = new URL(
        (await raw(`/auth/callback?token_hash=${hash}&type=magiclink`)).location
      )
      expect(again.pathname).toBe('/login')
      expect(again.searchParams.get('error')).toBeTruthy()
      expect(again.searchParams.get('error_description')).toBeTruthy()
    }
  )
  standard('a link of another kind is refused as malformed', async () => {
    const r = new URL((await raw('/auth/callback?token_hash=abc&type=sms')).location)
    expect(r.pathname).toBe('/login')
    expect(r.searchParams.get('error')).toBe('invalid_request')
    expect(r.searchParams.get('error_description')).toBe('This link is malformed.')
  })
  standard(
    'a code made in another browser (no verifier here) brings the person to /login with the reason',
    async () => {
      const r = new URL(
        (await raw('/auth/callback?code=00000000-0000-0000-0000-000000000000')).location
      )
      expect(r.pathname).toBe('/login')
      expect(r.searchParams.get('error')).toBeTruthy()
    }
  )
})

describe('S3 /auth/callback sends people only to a path on this site', () => {
  smoke('another site becomes the home page', async () => {
    for (const next of ['https://evil.example/x', '//evil.example/x']) {
      const hash = await tokenHash('magiclink', emailOf('reader'))
      const r = await raw(
        `/auth/callback?token_hash=${hash}&type=magiclink&next=${encodeURIComponent(next)}`
      )
      const to = new URL(r.location)
      expect(to.origin).toBe(new URL(env.baseUrl).origin)
      expect(to.pathname).toBe('/')
    }
  })
})

const TRACE = 'https://trace.manifund.org/auth/handoff'

describe('S20 /sso hands a signed-in session to Trace in the URL fragment', () => {
  smoke('signed in: to the Trace page, with the tokens and `then` after the #', async () => {
    const r = await raw(
      `/sso?next=${encodeURIComponent(TRACE)}&then=${encodeURIComponent('/suggestions')}`,
      await cookieForEmail(emailOf('reader'))
    )
    expect(r.status).toBe(307)
    const to = new URL(r.location)
    expect(`${to.origin}${to.pathname}`).toBe(TRACE)
    expect(to.search).toBe('')
    const handed = new URLSearchParams(to.hash.slice(1))
    expect(handed.get('access_token')?.length).toBeGreaterThan(20)
    expect(handed.get('refresh_token')).toBeTruthy()
    expect(handed.get('next')).toBe('/suggestions')
  })
  standard('`then` that is not a path becomes /', async () => {
    const r = await raw(
      `/sso?next=${encodeURIComponent(TRACE)}&then=${encodeURIComponent('https://evil.example')}`,
      await cookieForEmail(emailOf('reader'))
    )
    expect(new URLSearchParams(new URL(r.location).hash.slice(1)).get('next')).toBe('/')
  })
})

describe('S21 /sso hands sessions only to Trace (through the server)', () => {
  standard('another site is refused, even signed in', async () => {
    const r = await raw(
      `/sso?next=${encodeURIComponent('https://evil.example/auth/handoff')}`,
      await cookieForEmail(emailOf('reader'))
    )
    expect(r.status).toBe(400)
  })
})

describe('S22 signed out, /sso goes through /login and comes back', () => {
  smoke('to /login, whose next is the same /sso call', async () => {
    const r = await raw(
      `/sso?next=${encodeURIComponent(TRACE)}&then=${encodeURIComponent('/suggestions')}`
    )
    expect(r.status).toBe(307)
    const login = new URL(r.location)
    expect(login.pathname).toBe('/login')
    const back = new URL(login.searchParams.get('next')!, env.baseUrl)
    expect(back.pathname).toBe('/sso')
    expect(back.searchParams.get('next')).toBe(TRACE)
    expect(back.searchParams.get('then')).toBe('/suggestions')
    expect((await raw(`${login.pathname}${login.search}`)).status).toBe(200)
  })
})

describe('S16 only admins ban', () => {
  smoke('visitors and signed-in people are refused, and the person stays', async () => {
    const target = await person('target')
    for (const who of [anonymous(), reader]) {
      const r = await who.post('/api/superban-user', { userId: target.id })
      expect(r.status).toBe(401)
    }
    expect(await sql`select 1 from profiles where id = ${target.id}`).toHaveLength(1)
  })

  standard(
    'an admin bans: the person, their project and comment, and their account are gone (S17)',
    async () => {
      const spammer = await person('spammer')
      const project = await makeProject(sql, spammer.id, 'active', `${RUN}-spam`)
      const posted = await spammer.post('/api/comments', {
        target: { project: project.id },
        content: doc(`spam ${RUN}`),
      })
      expect(posted.status).toBe(201)

      const rita = (await getPeople()).rita
      const admin = client(rita.id, rita.username, await cookieForEmail(rita.email)) // unguarded: see the top of the file
      const r = await admin.post('/api/superban-user', { userId: spammer.id })
      expect(r.status).toBe(200)

      expect(await sql`select 1 from projects where id = ${project.id}`).toHaveLength(0)
      expect(await sql`select 1 from comments where commenter = ${spammer.id}`).toHaveLength(0)
      expect(await sql`select 1 from profiles where id = ${spammer.id}`).toHaveLength(0)
      expect(await sql`select 1 from auth.users where id = ${spammer.id}`).toHaveLength(0)
    }
  )
})
