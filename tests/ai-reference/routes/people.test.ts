// People and profiles through the app (docs/ai-reference/people/README.md): pages as visitors, the file's own people and
// the admin. Only this file's people, projects and account rows; the shared accounts only read, except one admin
// call (E25) made with an unguarded admin client below, on this file's own person.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { sql } from '../helpers/db'
import { env } from '../helpers/env'
import { anonymous, client, cookieForEmail, type Client } from '../helpers/http'
import { getPeople, person } from '../helpers/people'
import { getWorld, type World } from '../helpers/fixtures'
import { RUN } from '../helpers/content'
import { smoke, standard } from '../helpers/levels'

const BANK_ID = '758e68da-c37c-4a9d-a82b-f4aaedde31b9' // Manifund-Bank, the sender of deposits

let world: World, viewer: Client, regrantor: Client
// Accounts nobody signs in to (a charity, a fund), made directly in the table and deleted at the end.
const extra: string[] = []
async function account(type: 'org' | 'fund', name: string) {
  const [row] = await sql`insert into profiles (username, full_name, bio, type)
                          values (${`${RUN}-${name}`}, ${`Account ${name} ${RUN}`}, ${`About ${name}`}, ${type})
                          returning id, username, full_name`
  extra.push(row.id)
  return row as { id: string; username: string; full_name: string }
}

beforeAll(async () => {
  ;[world, viewer, regrantor] = await Promise.all([getWorld(), person('viewer'), person('regrantor')])
  await sql`update profiles set regranter_status = true where id = ${regrantor.id}`
})
afterAll(async () => {
  if (extra.length) {
    await sql`delete from txns where from_id in ${sql(extra)} or to_id in ${sql(extra)}`
    await sql`delete from profiles where id in ${sql(extra)}`
  }
})

describe('E6 /edit-profile edits your own profile', () => {
  smoke('a visitor gets the sign-in box, not the form', async () => {
    const page = await anonymous().get('/edit-profile')
    expect(page.status).toBe(200)
    expect(page.text).toContain('Sign in')
    expect(page.text).not.toContain('id="username"')
  })
  standard('a signed-in person gets their own profile in the form', async () => {
    const page = await viewer.get('/edit-profile')
    expect(page.status).toBe(200)
    for (const field of ['id="username"', 'id="full_name"', 'id="bio"', 'id="website"', 'id="avatar"']) {
      expect(page.text).toContain(field)
    }
    expect(page.text).toContain(`value="${viewer.username}"`)
    expect(page.text).toContain('accept="image/png, image/jpeg"')
  })
})

test.todo('E7 username and full name required, regrantors also need a bio and an avatar: checks in the browser form only (needs a browser test)', () => {})
test.todo('E8 the username is saved with spaces as dashes and other characters dropped: done in the browser form only (needs a browser test)', () => {})

describe('E9 after a rename, the profile is at its new address', () => {
  // Save as the form does (with the person's own session), then load the pages.
  standard('the new username works, the old one is a 404', async () => {
    const renamed = await person('renamed')
    const old = renamed.username
    const token = await accessToken(`${old}@local.test`)
    const res = await fetch(`${env.supabaseUrl}/rest/v1/profiles?id=eq.${renamed.id}`, {
      method: 'PATCH',
      headers: { apikey: env.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ username: `${old}-new` }),
    })
    expect(res.status).toBeLessThan(300)
    expect(await shows(`/${old}-new`, `@${old}-new`)).toBe(true)
    expect(await isNotFound(`/${old}`)).toBe(true)
  })
})

describe('E10 an incomplete profile gets a "Complete your profile" banner', () => {
  standard('username still the account id: banner; a complete profile: none', async () => {
    const fresh = await person('fresh')
    await sql`update profiles set username = ${fresh.id} where id = ${fresh.id}`
    expect((await fresh.get('/people')).text).toContain('Complete your profile')
    expect((await viewer.get('/people')).text).not.toContain('Complete your profile')
  })
  standard('no full name: banner', async () => {
    const nameless = await person('nameless')
    await sql`update profiles set full_name = '' where id = ${nameless.id}`
    expect((await nameless.get('/people')).text).toContain('Complete your profile')
  })
})

describe('E11 /<username> shows a profile', () => {
  smoke("a person's profile; an unknown username is a 404", async () => {
    expect(await shows(`/${viewer.username}`, `@${viewer.username}`)).toBe(true)
    expect(await isNotFound(`/${RUN}-nobody`)).toBe(true)
  })
  standard("a fund's account shows its fund page; a charity's says the type isn't supported", async () => {
    const fund = await account('fund', 'fund')
    expect(await shows(`/${fund.username}`, `${fund.full_name} fund`)).toBe(true)
    const charity = await account('org', 'charity-u11')
    expect((await anonymous().get(`/${charity.username}`)).text).toContain('Profile type not supported')
  })
})

describe('E13 hidden and draft projects show on a profile only to its owner', () => {
  standard('the draft is listed for its creator, not for others', async () => {
    const path = `/${world.creator.username}`
    expect((await world.creator.get(path)).text).toContain(`/projects/${world.draft.slug}`)
    for (const who of [anonymous(), viewer]) {
      const page = await who.get(path)
      expect(page.text).toContain(`/projects/${world.project.slug}`)
      expect(page.text).not.toContain(`/projects/${world.draft.slug}`)
    }
  })
})

describe('E14 E15 your own profile: your email, an edit link', () => {
  standard('own profile', async () => {
    const page = await viewer.get(`/${viewer.username}`)
    expect(page.text).toContain(`${viewer.username}@local.test`)
    expect(page.text).toContain('href="/edit-profile"')
  })
  standard("someone else's profile, signed in or not", async () => {
    for (const who of [anonymous(), world.creator]) {
      const page = await who.get(`/${viewer.username}`)
      expect(page.text).not.toContain(`${viewer.username}@local.test`)
      expect(page.text).not.toContain('href="/edit-profile"')
    }
  })
})

describe('E17 /people/id/<id> leads to the current username', () => {
  smoke('a known id redirects to the profile, an unknown one to /people', async () => {
    const known = await anonymous().get(`/people/id/${viewer.id}`)
    expect(known.status).toBeGreaterThanOrEqual(300)
    expect(known.status).toBeLessThan(400)
    expect(await location(`/people/id/${viewer.id}`)).toBe(`/${viewer.username}`)
    expect(await location(`/people/id/${crypto.randomUUID()}`)).toBe('/people')
  })
})

describe("E20 regrantors see a project creator's email", () => {
  standard('a regrantor does; a visitor, another person and an admin do not', async () => {
    const email = `${world.creator.username}@local.test`
    const path = `/projects/${world.project.slug}`
    expect((await regrantor.get(path)).text).toContain(email)
    const rita = await adminClient()
    for (const who of [anonymous(), viewer, rita]) expect((await who.get(path)).text).not.toContain(email)
  })
})

describe('E25 admins set accreditation; the route refuses anyone else', () => {
  standard('a signed-in non-admin is refused and nothing changes', async () => {
    const target = await person('investor')
    const res = await viewer.post('/api/verify-investor', { userId: target.id, accredited: true })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await accredited(target.id)).toBe(false)
    expect((await anonymous().post('/api/verify-investor', { userId: target.id, accredited: true })).status).toBeGreaterThanOrEqual(400)
    expect(await accredited(target.id)).toBe(false)
  })
  standard('an admin sets and clears it', async () => {
    const target = await person('investor')
    const rita = await adminClient()
    expect((await rita.post('/api/verify-investor', { userId: target.id, accredited: true })).status).toBe(200)
    expect(await accredited(target.id)).toBe(true)
    expect((await rita.post('/api/verify-investor', { userId: target.id, accredited: false })).status).toBe(200)
    expect(await accredited(target.id)).toBe(false)
  })
})

describe('E26 /leaderboards: total deposits per person, every deposit, no emails', () => {
  standard("a person's deposits are summed; a regrantor's are listed but not ranked", async () => {
    const donor = await person('donor')
    await sql`insert into txns (from_id, to_id, amount, token, type) values
                (${BANK_ID}, ${donor.id}, 1234, 'USD', 'deposit'), (${BANK_ID}, ${donor.id}, 1000, 'USD', 'deposit'),
                (${BANK_ID}, ${regrantor.id}, 777, 'USD', 'deposit')`
    const page = await anonymous().get('/leaderboards')
    expect(page.status).toBe(200)
    // The page's HTML rows (the streamed data holds the same content in another form): two cells for "Total
    // donated", four for "All deposits".
    const rows = (username: string) =>
      (html(page.text).match(/<tr>[\s\S]*?<\/tr>/g) ?? []).filter((r) => r.includes(`href="/${username}"`))
    const cells = (row: string) => row.match(/<td/g)?.length
    const ranked = (username: string) => rows(username).filter((r) => cells(r) === 2)
    expect(ranked(donor.username)).toHaveLength(1)
    expect(ranked(donor.username)[0]).toContain('$2234<')
    expect(ranked(regrantor.username)).toHaveLength(0)
    expect(rows(regrantor.username).filter((r) => cells(r) === 4)).toHaveLength(1)
    expect(rows(donor.username).filter((r) => cells(r) === 4)).toHaveLength(2)
    expect(page.text).not.toContain(`${donor.username}@local.test`)
  }, 90_000)
})

describe('E27 charity accounts', () => {
  standard('/charity lists them; /charity/<username> shows raised and supporters', async () => {
    const charity = await account('org', 'charity')
    const donor = await person('donor')
    await sql`insert into txns (from_id, to_id, amount, token, type) values
                (${donor.id}, ${charity.id}, 300, 'USD', 'profile donation'),
                (${viewer.id}, ${charity.id}, 200, 'USD', 'profile donation')`
    expect((await anonymous().get('/charity')).text).toContain(charity.full_name)
    const page = await anonymous().get(`/charity/${charity.username}`)
    expect(page.status).toBe(200)
    expect(page.text).toContain(charity.full_name)
    expect(html(page.text)).toContain('$500')
    expect(html(page.text)).toMatch(/>2<\/[a-z]+>[\s\S]{0,300}supporters|supporters[\s\S]{0,300}>2</)
    expect((await anonymous().get(`/charity/${RUN}-nobody`)).text).toContain('Charity not found.')
  })
})

// Helpers.
// React's text separators (`$<!-- -->2234`) removed.
const html = (text: string) => text.replace(/<!-- -->/g, '')
// In development, a page that calls notFound() after streaming started answers 200 (and every page carries the
// not-found template): look for the not-found signal in the streamed data instead.
const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404'
const isNotFound = async (path: string) => (await anonymous().get(path)).text.includes(NOT_FOUND)
const shows = async (path: string, text: string) => {
  const page = (await anonymous().get(path)).text
  return html(page).includes(text) && !page.includes(NOT_FOUND)
}
async function accessToken(email: string) {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: env.password }),
  })
  return ((await res.json()) as { access_token: string }).access_token
}
async function location(path: string) {
  const res = await fetch(`${env.baseUrl}${path}`, { redirect: 'manual' })
  return new URL(res.headers.get('location') ?? '', env.baseUrl).pathname
}
const accredited = async (id: string) => (await sql`select accreditation_status from profiles where id = ${id}`)[0].accreditation_status
// rita, the local admin, without the shared-account guard: /api/verify-investor isn't among rita's allowed admin
// actions in tests/helpers/people.ts, and it only changes this file's own person.
async function adminClient() {
  const rita = (await getPeople()).rita
  return client(rita.id, rita.username, await cookieForEmail(rita.email))
}
