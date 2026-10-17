// Causes (docs/ai-reference/causes): what a cause's page and the cause picker show, rendered to HTML. Made-up projects,
// people and amounts; nothing is read from the database.
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SelectCauses } from '@/components/select-causes'
import { CauseData } from '@/app/causes/[causeSlug]/cause-data'
import { Donors } from '@/app/causes/[causeSlug]/donors'
import QuadraticMatch from '@/app/causes/[causeSlug]/qf'

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('R8 at most 3 causes per project', () => {
  const causes = ['tais', 'ai-gov', 'biosec', 'ea'].map((slug) => ({
    slug,
    title: `Title ${slug}`,
  }))
  const render = (selected: number) =>
    renderToStaticMarkup(
      <SelectCauses
        causesList={causes}
        selectedCauses={causes.slice(0, selected)}
        setSelectedCauses={() => {}}
      />
    )
  test('with 2 chosen, every cause can still be picked', () => {
    const html = render(2)
    expect(html).not.toContain('disabled')
    expect(html).not.toContain('Maximum of 3 cause areas selected')
  })
  test('with 3 chosen, the others are disabled and the limit is said', () => {
    const html = render(3)
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(1)
    expect(html).toContain('Maximum of 3 cause areas selected')
  })
})

describe("R4 a cause's page counts proposals, active projects and money raised", () => {
  const project = (id: string, stage: string, fields: Record<string, unknown> = {}) =>
    ({
      id,
      stage,
      type: 'grant',
      creator: `creator-${id}`,
      funding_goal: 0,
      bids: [],
      txns: [],
      ...fields,
    }) as any
  test('a proposal counts its pending offers, an active project the donations its creator received', () => {
    const projects = [
      project('a', 'proposal', {
        bids: [
          { type: 'donate', status: 'pending', amount: 300 },
          { type: 'donate', status: 'declined', amount: 50 },
        ],
      }),
      project('b', 'active', {
        txns: [
          { to_id: 'creator-b', token: 'USD', amount: 1000 },
          { to_id: 'someone-else', token: 'USD', amount: 70 },
        ],
      }),
      project('c', 'active'),
      project('d', 'complete', { txns: [{ to_id: 'creator-d', token: 'USD', amount: 200 }] }),
    ]
    const html = text(renderToStaticMarkup(<CauseData projects={projects} />))
    expect(html).toContain('1 proposals')
    expect(html).toContain('2 active projects')
    expect(html).toContain('$1.5K') // 300 offered + 1000 + 200 received; the declined offer and others' txns don't count
  })
})

describe('R16 EA Community Choice participants: $100 per role claimed', () => {
  const ada = {
    id: 'd1',
    username: 'ada-123',
    full_name: 'Ada',
    roles: { scholar: 'https://scholar.example/x/ada', senior: 'yes', worker: null },
  }
  const ben = { id: 'd2', username: 'ben-456', full_name: '', roles: { donor: true } }
  test('each participant with their roles, and the totals', () => {
    const html = text(renderToStaticMarkup(<Donors donors={[ada, ben] as any} />))
    expect(html).toContain('Total participants 2')
    expect(html).toContain('Ada - 200')
    expect(html).toContain('ben - 100') // no name: the username's first part
    expect(html).toContain('scholar : ada') // a scholar link shows its last part
    expect(html).toContain('Total $ claimed $300')
    expect(html).toContain('Quadratic matching fund $100000')
  })

  // Open question 8 (docs/ai-reference/causes/README.md): the roles object includes the row's id, which counts as one
  // more claimed role. Turn on once fixed.
  test.skip('the id in the roles row is not counted as a role (open question 8)', () => {
    const withId = [
      { ...ada, roles: { id: 'd1', ...ada.roles } },
      { ...ben, roles: { id: 'd2', ...ben.roles } },
    ]
    const html = text(renderToStaticMarkup(<Donors donors={withId as any} />))
    expect(html).toContain('Ada - 200')
    expect(html).toContain('Total $ claimed $300')
  })
})

describe('R17 EA Community Choice matching: quadratic shares of the $100k pool', () => {
  const IN = '2024-08-20T00:00:00.000Z'
  const OUT = '2024-09-06T00:00:00.000Z'
  const txn = (project: string, donor: string, amount: number, created_at = IN) =>
    ({ project, amount, created_at, profiles: { id: donor } }) as any
  const offer = (
    project: string,
    donor: string,
    amount: number,
    created_at = IN,
    status = 'pending'
  ) => ({ project, amount, created_at, status, profiles: { id: donor } }) as any
  const projects = [
    { id: 'p1', slug: 'many', title: 'Many small donors' },
    { id: 'p2', slug: 'one', title: 'One big donor' },
  ] as any

  test("many small donors beat one big donor; one donor's amounts to a project add up", () => {
    // p1: two donors of 100 (one in two parts): (10 + 10)^2 = 400. p2: one donor of 300: 300.
    const html = text(
      renderToStaticMarkup(
        <QuadraticMatch
          projects={projects}
          matchTxns={[txn('p1', 'x', 60), txn('p2', 'z', 300)]}
          matchBids={[offer('p1', 'x', 40), offer('p1', 'y', 100)]}
        />
      )
    )
    // Rows: project, donors, donated, matched (pool share), total.
    expect(html).toContain('Many small donors 2 200 57143 57343')
    expect(html).toContain('One big donor 1 300 42857 43157')
    expect(html.indexOf('Many small donors')).toBeLessThan(html.indexOf('One big donor'))
    expect(html).toContain('Total 3 500 100000 100500')
    expect(html).toContain('projections')
  })
  test('only donations and offers inside the window count', () => {
    const html = text(
      renderToStaticMarkup(
        <QuadraticMatch
          projects={projects}
          matchTxns={[
            txn('p1', 'x', 100),
            txn('p1', 'late', 900, OUT),
            txn('p1', 'early', 900, '2024-08-11T23:59:59.000Z'),
          ]}
          matchBids={[]}
        />
      )
    )
    expect(html).toContain('Many small donors 1 100 100000 100100')
  })
  test('a project hidden since shows as "Hidden project"', () => {
    const html = text(
      renderToStaticMarkup(
        <QuadraticMatch projects={projects} matchTxns={[txn('gone', 'x', 100)]} matchBids={[]} />
      )
    )
    expect(html).toContain('Hidden project 1 100')
  })

  // Open question 3 (docs/ai-reference/causes/README.md): offers count whatever their status, and an offer that
  // became a donation counts twice. Turn on if the projection is fixed.
  test.skip("declined offers don't count, and an accepted offer counts once with its donation (open question 3)", () => {
    const html = text(
      renderToStaticMarkup(
        <QuadraticMatch
          projects={projects}
          matchTxns={[txn('p1', 'x', 100)]}
          matchBids={[offer('p1', 'x', 100, IN, 'accepted'), offer('p1', 'y', 500, IN, 'declined')]}
        />
      )
    )
    expect(html).toContain('Many small donors 1 100 100000 100100')
  })
})
