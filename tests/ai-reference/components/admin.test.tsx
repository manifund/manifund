// What the admin tables show (docs/ai-reference/admin/README.md), rendered to HTML with made-up rows (never real people).
// The projects table's "Restore" button uses the router: stubbed here (rendering never calls it). The stub has the
// same shape as tests/ai-reference/components/people.test.tsx's (Bun keeps module mocks across files in one process), plus the
// real module's other exports.
import { describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

const realNavigation = await import('next/navigation')
mock.module('next/navigation', () => ({
  ...realNavigation,
  useRouter: () => ({ push() {}, refresh() {}, back() {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const { UserTable } = await import('@/app/admin/users/user-table')
const { ProjectTable } = await import('@/app/admin/projects/project-table')
const { Donations } = await import('@/app/admin/donations')

const ANN = '11111111-1111-1111-1111-111111111111'
const NONAME = '22222222-2222-2222-2222-222222222222'

describe('M4 M5 /admin/users: one row per account', () => {
  const html = renderToStaticMarkup(
    <UserTable
      users={[
        { id: ANN, email: 'ann@example.test', username: 'ann', accredited: true, balance: 10.126 },
        {
          id: NONAME,
          email: 'noname@example.test',
          username: null,
          accredited: false,
          balance: -3,
        },
      ]}
    />
  )
  test('email, username linking to the profile, accreditation, and a link to the row in Supabase', () => {
    expect(html).toContain('ann@example.test')
    expect(html).toContain('href="/ann"')
    expect(html).toContain('noname@example.test')
    expect(html).toContain('—') // no username
    expect(html).toContain('✅')
    expect(html).toContain('❌')
    expect(html).toContain(`filter=id%3Aeq%3A${ANN}`)
    expect(html).toContain('placeholder="Search email or username"')
  })
  test('the balance, to at most two decimals, with the pay box and the receipt option', () => {
    expect(html).toContain('>10.13<')
    expect(html).toContain('>-3<')
    expect(html).toContain('Receipt')
    expect(html.match(/>Add</g)).toHaveLength(2)
  })
})

describe('M9 /admin/projects: one row per project, "Restore" only on projects that were not funded', () => {
  const row = (id: string, stage: string) => ({
    id,
    slug: `slug-${stage.replace(' ', '-')}`,
    title: `Project ${stage}`,
    username: 'ann',
    minFunding: 1500,
    stage,
  })
  const html = renderToStaticMarkup(
    <ProjectTable
      projects={[row('p1', 'not funded'), row('p2', 'active'), row('p3', 'proposal')]}
    />
  )
  test('title linking to the project, creator, stage, minimum, and a link to the row in Supabase', () => {
    expect(html).toContain('href="/projects/slug-active"')
    expect(html).toContain('Project active')
    expect(html).toContain('href="/ann"')
    expect(html).toContain('>1500<')
    expect(html).toContain('filter=id%3Aeq%3Ap2')
    expect(html).toContain('placeholder="Search title or creator"')
  })
  test('one Restore button, on the "not funded" project', () => {
    expect(html.match(/<button[^>]*>Restore<\/button>/g)).toHaveLength(1)
  })
})

describe('M13 /admin/tools: money given to each organization outside projects, since a date (today by default)', () => {
  const org = (id: string, name: string) => ({ id, full_name: name, website: null }) as any
  const now = new Date().toISOString()
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
  const t = (to_id: string, amount: number, created_at: string, project: string | null = null) =>
    ({ to_id, amount, created_at, project, from_id: 'someone' }) as any
  test('counts txns to the org with no project since the start of today', () => {
    const html = renderToStaticMarkup(
      <Donations
        charities={[org('o1', 'Org One'), org('o2', 'Org Two')]}
        txns={[
          t('o1', 100, now),
          t('o1', 50, now),
          t('o1', 1000, now, 'some-project'), // on a project: not counted
          t('o1', 7, twoDaysAgo), // before the start date: not counted
          t('o2', 20, twoDaysAgo),
          t('elsewhere', 999, now),
        ]}
      />
    )
    expect(html).toContain('Org One')
    expect(html).toContain('$150')
    expect(html).toContain('Org Two')
    expect(html).toContain('$0')
  })
})
