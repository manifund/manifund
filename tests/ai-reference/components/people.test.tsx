// What a profile's header and the people list show (docs/ai-reference/people/README.md), rendered to HTML.
// Both are client components that use the router and the Supabase provider: stub them (rendering never calls them).
import { describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

// Keep the real modules' other exports (e.g. `redirect`): Bun keeps module mocks across the files of one process.
const realNavigation = await import('next/navigation')
mock.module('next/navigation', () => ({
  ...realNavigation,
  useRouter: () => ({ push() {}, refresh() {}, back() {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
const realProvider = await import('@/db/supabase-provider')
mock.module('@/db/supabase-provider', () => ({ ...realProvider, useSupabase: () => ({ supabase: {}, session: null }) }))

const { ProfileHeader } = await import('@/app/[usernameSlug]/profile-header')
const { PeopleDisplay } = await import('@/app/people/people-display')
const { UserBadge } = await import('@/components/user-link')

// Made-up people, never rows in a database.
let n = 0
function profile(fields: Record<string, unknown> = {}): any {
  n++
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    username: `person${n}`,
    full_name: `Person ${n}`,
    bio: '',
    website: null,
    long_description: null,
    avatar_url: null,
    type: 'individual',
    regranter_status: false,
    accreditation_status: false,
    projects: [],
    ...fields,
  }
}
const header = (p: any, own: boolean, email?: string) =>
  renderToStaticMarkup(<ProfileHeader profile={p} isOwnProfile={own} email={email} />)
const people = (ps: any[]) => renderToStaticMarkup(<PeopleDisplay profiles={ps} />)
// The people list's rows, in order: their links to profiles.
const rows = (html: string) => [...html.matchAll(/<a class="flex-2[^"]*" href="\/([^"]+)"/g)].map((m) => m[1])
const REGRANTOR_TAG = 'bg-orange-500 p-0.5' // the people list's small regrantor tag
const CREATOR_TAG = 'bg-blue-500 p-0.5'

describe('E12 a profile shows the name, @username, bio and website', () => {
  test('name, username, bio, and the website as a link', () => {
    const html = header(profile({ full_name: 'Ann Lee', username: 'annlee', bio: 'Works on evals', website: 'ann.example' }), false)
    for (const text of ['Ann Lee', '@annlee', 'Works on evals', 'href="https://ann.example"']) expect(html).toContain(text)
  })
  test('no website, no link', () => {
    expect(header(profile(), false)).not.toContain('href="https://')
  })
})

describe('E14 the email address shows only on your own profile', () => {
  test('own profile: shown', () => {
    expect(header(profile(), true, 'me@example.test')).toContain('me@example.test')
  })
  test("someone else's profile: not shown, even if the page had it", () => {
    expect(header(profile(), false, 'them@example.test')).not.toContain('them@example.test')
  })
})

describe('E15 your own profile has an edit link and a sign-out button', () => {
  test('own profile', () => {
    const html = header(profile(), true, 'me@example.test')
    expect(html).toContain('href="/edit-profile"')
    expect(html).toContain('Sign out')
  })
  test("someone else's profile", () => {
    const html = header(profile(), false)
    expect(html).not.toContain('href="/edit-profile"')
    expect(html).not.toContain('Sign out')
  })
})

describe('E16 accreditation is shown neither on profiles nor on /people', () => {
  test('profile header', () => {
    const p = profile({ accreditation_status: true, regranter_status: false })
    expect(header(p, false)).toBe(header({ ...p, accreditation_status: false }, false))
  })
  test('people list', () => {
    const p = profile({ accreditation_status: true, bio: 'x' })
    expect(people([p])).toBe(people([{ ...p, accreditation_status: false }]))
  })
})

describe('E18 regrantors are tagged on their profile and on /people', () => {
  test('profile header', () => {
    expect(header(profile({ regranter_status: true }), false)).toContain('>regrantor<')
    expect(header(profile(), false)).not.toContain('>regrantor<')
  })
  test('people list', () => {
    expect(people([profile({ regranter_status: true })])).toContain(REGRANTOR_TAG)
    expect(people([profile()])).not.toContain(REGRANTOR_TAG)
  })
})

describe('E19 badges next to names come from lists of usernames', () => {
  test('a username on the 2025 regrantor list gets a badge; the team gets their own; others none', () => {
    const regrantor = renderToStaticMarkup(<UserBadge username="NeelNanda" />)
    const team = renderToStaticMarkup(<UserBadge username="Austin" />)
    expect(regrantor).toContain('<svg')
    expect(team).toContain('<svg')
    expect(team).not.toBe(regrantor)
    expect(renderToStaticMarkup(<UserBadge username="someone-new" />)).toBe('')
  })
  // Open question (people doc, "Two sources for regrantor"): the badge doesn't follow regranter_status, and
  // UserBadge only knows the username, so this can't be written until it does.
  test.todo('E19 any current regrantor gets the badge next to their name', () => {})
})

describe('E21 /people lists individuals with a complete profile', () => {
  test('a username other than the id, and a full name', () => {
    const ok = profile()
    const noUsername = profile()
    noUsername.username = noUsername.id
    const noName = profile({ full_name: '' })
    expect(rows(people([ok, noUsername, noName]))).toEqual([ok.username])
  })
  test('charities, funds and the market maker are left out', () => {
    const ok = profile()
    const others = ['org', 'fund', 'amm'].map((type) => profile({ type }))
    expect(rows(people([...others, ok]))).toEqual([ok.username])
  })
})

describe('E22 /people order: regrantors, people with a project, with a bio, accredited, the rest', () => {
  test('groups in that order', () => {
    const rest = profile()
    const accredited = profile({ accreditation_status: true })
    const withBio = profile({ bio: 'hello' })
    const creator = profile({ projects: [{ title: 'A project' }] })
    const regrantor = profile({ regranter_status: true })
    expect(rows(people([rest, accredited, withBio, creator, regrantor]))).toEqual(
      [regrantor, creator, withBio, accredited, rest].map((p) => p.username)
    )
  })
})

describe('E23 a row: avatar, name, bio, tags, link to the profile', () => {
  test('name, bio and link', () => {
    const p = profile({ full_name: 'Ann Lee', bio: 'Works on evals' })
    const html = people([p])
    for (const text of ['Ann Lee', 'Works on evals', `href="/${p.username}"`]) expect(html).toContain(text)
  })
  test('the creator tag goes to anyone with a project, whatever its stage', () => {
    expect(people([profile({ projects: [{ title: 'A draft' }] })])).toContain(CREATOR_TAG)
    expect(people([profile({ bio: 'x' })])).not.toContain(CREATOR_TAG)
  })
})

describe('E24 /people loads 50 rows at a time', () => {
  test('60 people: 50 rows at first', () => {
    expect(rows(people(Array.from({ length: 60 }, () => profile())))).toHaveLength(50)
  })
})
