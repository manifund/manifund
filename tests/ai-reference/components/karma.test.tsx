// Karma on screen (docs/ai-reference/karma/README.md): the karma sort and where the number shows, rendered to HTML.
// Made-up projects and people; nothing is read from the database.
import { describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { ReactNode } from 'react'

// The cards' module graph reaches a server-only module (unused when rendering): let it load outside a server.
mock.module('server-only', () => ({}))
const { Karma } = await import('@/components/karma')
const { ProjectCard } = await import('@/components/project-card')
const { ProjectsDisplay } = await import('@/components/projects-display')

// Cards link through the app router; a do-nothing one is enough to render.
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} } as any
const render = (node: ReactNode) =>
  renderToStaticMarkup(<AppRouterContext.Provider value={router}>{node}</AppRouterContext.Provider>)

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

const creator = {
  id: 'creator',
  username: 'creator',
  full_name: 'Casey Creator',
  avatar_url: null,
  type: 'individual',
  regranter_status: false,
  karma: 0,
}
// A grant project with what the cards read; karma and age vary per test.
const project = (id: string, karma: number, createdAt = '2026-10-01T00:00:00Z') =>
  ({
    id,
    title: `Project ${id}`,
    blurb: `About ${id}`,
    slug: id,
    creator: creator.id,
    created_at: createdAt,
    stage: 'active',
    type: 'grant',
    funding_goal: 1000,
    min_funding: 100,
    amm_shares: null,
    founder_shares: 10000000,
    auction_close: null,
    approved: true,
    signed_agreement: true,
    lobbying: false,
    ai_fraction: 0,
    quality_score: null,
    karma,
    karma_breakdown: null,
    profiles: creator,
    bids: [],
    txns: [],
    comments: [],
    rounds: { title: 'Regrants', slug: 'regrants' },
    causes: [],
    project_votes: [
      { magnitude: 1, voter_id: 'a' },
      { magnitude: 1, voter_id: 'b' },
      { magnitude: 1, voter_id: 'c' },
    ],
    project_transfers: [],
  }) as any

describe('K11 sorting a project list by karma', () => {
  test('highest karma first', () => {
    const html = render(
      <ProjectsDisplay
        projects={[project('low', 5), project('high', 500), project('mid', 50)]}
        causesList={[]}
        defaultSort="karma"
      />
    )
    const order = ['high', 'mid', 'low'].map((id) => html.indexOf(`Project ${id}`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('K10 the hot order is the default', () => {
  test('the hot order (the default) puts karma decayed by age first: a young project beats an older one with more karma', () => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const html = render(
      <ProjectsDisplay
        projects={[
          project('old', 300, new Date(now - 30 * day).toISOString()),
          project('young', 20, new Date(now - 1 * day).toISOString()),
        ]}
        causesList={[]}
      />
    )
    expect(html.indexOf('Project young')).toBeLessThan(html.indexOf('Project old'))
  })
})

describe('K12 karma shows as a rounded number with a star', () => {
  test('the number is rounded; before a recompute it is 0', () => {
    const html = renderToStaticMarkup(<Karma value={41.6} breakdown={null} kind="project" />)
    expect(text(html).trim()).toBe('42')
    expect(html).toContain('<svg')
    expect(text(renderToStaticMarkup(<Karma value={null} breakdown={null} kind="profile" />)).trim()).toBe('0')
  })
  test('project cards show karma and no vote count', () => {
    const html = text(render(<ProjectCard project={project('card', 123.4)} />))
    expect(html).toMatch(/(^|\s)123(\s|$)/)
    // Before #286 the footer showed the net votes (here three upvotes: "3") next to the comment count.
    expect(html).not.toMatch(/(^|\s)3(\s|$)/)
  })
})
