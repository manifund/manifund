// What one donor's answers show to visitors, to the donor and to admins (docs/ai-reference/donor-survey/README.md, D17,
// D18), rendered to HTML with a made-up response (never real answers). The avatar uses the router: stubbed here
// (rendering never calls it), with the same shape as the other component tests' stub (Bun keeps module mocks across
// files in one process), plus the real module's other exports.
import { describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DonorSurveyResponse } from '@/db/donor-survey'

const realNavigation = await import('next/navigation')
mock.module('next/navigation', () => ({
  ...realNavigation,
  useRouter: () => ({ push() {}, refresh() {}, back() {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const { DonorResponseView } = await import('@/components/donor-response-view')
const { DonorPageHeader } = await import('@/components/donor-page-header')

const full: DonorSurveyResponse = {
  id: '00000000-0000-0000-0000-00000000d0a0',
  profile_id: '00000000-0000-0000-0000-0000000000a1',
  full_name: 'Ada When',
  email: 'ada-private@example.test',
  capacity: ['own_money', 'regrantor'],
  org: 'Example Fund',
  giving_2026: '500k_2m',
  giving_2027: 'not_sure',
  cause_ratings: [
    { name: 'Progress', rating: 2 },
    { name: 'AI safety', rating: 5 },
  ],
  advice_sources: 'ADVICE-TEXT',
  landscape_problems: 'PROBLEMS-TEXT',
  funds_vs_direct: 75,
  already_given: 'GIVEN-TEXT',
  already_given_link: 'https://example.test/history',
  evaluation_approach: 'EVAL-TEXT',
  charities_interested: 'CHARITIES-TEXT',
  hours_per_month: '3_10',
  dream_setup: 'DREAM-TEXT',
  wants_opportunities: true,
  opportunity_frequency: 'monthly',
  wants_call: true,
  wants_events: true,
  share_with_funders: true,
  is_public: true,
  other_thoughts: 'THOUGHTS-TEXT',
  referrals: 'REFERRALS-TEXT',
  edit_token_hash: 'TOKEN-HASH',
  created_at: '2026-09-10T12:00:00Z',
  updated_at: '2026-09-12T12:00:00Z',
}
// Only the required questions answered.
const sparse: DonorSurveyResponse = {
  ...full,
  cause_ratings: [],
  advice_sources: null,
  landscape_problems: null,
  funds_vs_direct: null,
  already_given: null,
  already_given_link: null,
  evaluation_approach: null,
  charities_interested: null,
  hours_per_month: null,
  dream_setup: null,
  wants_opportunities: null,
  opportunity_frequency: null,
  other_thoughts: null,
  referrals: null,
}

const PUBLIC_ANSWERS = [
  '$500k–$2m',
  'Not sure yet',
  'AI safety',
  'ADVICE-TEXT',
  'PROBLEMS-TEXT',
  'Mostly my own picks',
  'GIVEN-TEXT',
  'https://example.test/history',
  'EVAL-TEXT',
  'CHARITIES-TEXT',
  '3–10',
  'DREAM-TEXT',
  'THOUGHTS-TEXT',
]
const view = (r: DonorSurveyResponse, opts: { full?: boolean; admin?: boolean } = {}) =>
  renderToStaticMarkup(<DonorResponseView response={r} {...opts} />)

describe('D17 visitors see the answered questions, never the private ones', () => {
  const html = view(full)
  test('every answered public question', () => {
    for (const text of PUBLIC_ANSWERS) expect(html).toContain(text)
  })
  test('cause ratings highest first', () => {
    expect(html.indexOf('AI safety')).toBeLessThan(html.indexOf('Progress'))
  })
  test('no email, referrals, contact or sharing choices, token', () => {
    for (const text of [
      'ada-private@example.test',
      'REFERRALS-TEXT',
      'TOKEN-HASH',
      'Staying in touch',
      'Monthly',
      'monthly',
      '1:1 call',
      'fundraising for top charities',
      'major funders',
    ])
      expect(html).not.toContain(text)
  })
  test('unanswered questions and empty sections are left out', () => {
    const html = view(sparse)
    expect(html).not.toContain('—')
    for (const text of [
      'Going deeper',
      'Wrapping up',
      'Interest in each cause area',
      'Where they go for advice',
    ])
      expect(html).not.toContain(text)
    expect(html).toContain('$500k–$2m')
  })
  test('the header: name, @username, capacity and organisation, 2026 band, date of the last change', () => {
    const html = renderToStaticMarkup(
      <DonorPageHeader
        profile={{
          id: full.profile_id!,
          username: 'adawhen',
          full_name: 'Ada When',
          avatar_url: null,
        }}
        response={full}
      />
    )
    for (const text of [
      'Ada When',
      '@adawhen',
      'I’m giving my own money, I’m a part-time regrantor or evaluator',
      '(Example Fund)',
      'Giving $500k–$2m in 2026',
      'September 12, 2026',
    ])
      expect(html).toContain(text)
  })
})

describe('D18 the donor and admins see more', () => {
  test('the donor: email, referrals, opportunities and events; gaps as "—"; not the call or sharing choices', () => {
    const html = view(full, { full: true })
    for (const text of [
      ...PUBLIC_ANSWERS,
      'ada-private@example.test',
      'REFERRALS-TEXT',
      'Yes, monthly',
      'Come to events centered on fundraising for top charities',
    ])
      expect(html).toContain(text)
    for (const text of ['1:1 call', 'With other major funders', 'TOKEN-HASH'])
      expect(html).not.toContain(text)
    expect(view(sparse, { full: true })).toContain('—')
  })
  test('admins: also the 1:1 call and the sharing choices', () => {
    const html = view(full, { full: true, admin: true })
    for (const text of [
      'Meet for a 1:1 call with a member of the Manifund team',
      'With other major funders',
      'On their public Manifund profile',
    ])
      expect(html).toContain(text)
    expect(html).not.toContain('TOKEN-HASH')
  })
})
