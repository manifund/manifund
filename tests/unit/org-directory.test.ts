import { describe, expect, test } from 'bun:test'
import {
  ALL_CAUSES,
  NO_FILTERS,
  causeCounts,
  filterOrgs,
  type DirectoryOrg,
} from '@/utils/org-directory'

const org = (name: string, patch: Partial<DirectoryOrg> = {}): DirectoryOrg => ({
  slug: name.toLowerCase(),
  name,
  logo_url: null,
  trace_slug: null,
  summary: null,
  cause: 'AI safety',
  focus: [],
  legalStructure: null,
  city: null,
  funding: null,
  fundingByYear: [0, 0, 0, 0, 0],
  staff: null,
  reviews: 0,
  ...patch,
})

const ORGS = [
  org('Evalco', {
    focus: ['Evals'],
    legalStructure: '501c3',
    funding: 10,
    summary: 'Measures agents',
  }),
  org('Fieldco', { focus: ['Field-building', 'Research'], legalStructure: 'non_us', funding: 30 }),
  org('Bioco', {
    cause: 'Biosecurity & health',
    focus: ['Research'],
    legalStructure: '501c3',
    reviews: 4,
  }),
]
const names = (orgs: DirectoryOrg[]) => orgs.map((o) => o.name)

describe('O11 directory filters: and across groups, any within a group', () => {
  test('no filters shows every org, most funded first', () => {
    expect(names(filterOrgs(ORGS, NO_FILTERS, 'Most funded'))).toEqual([
      'Fieldco',
      'Evalco',
      'Bioco',
    ])
  })
  test('several focuses match orgs with any of them', () => {
    const f = { ...NO_FILTERS, focus: ['Evals', 'Field-building'] }
    expect(names(filterOrgs(ORGS, f, 'A–Z'))).toEqual(['Evalco', 'Fieldco'])
  })
  test('cause, focus and legal type must all match', () => {
    const f = { ...NO_FILTERS, cause: 'AI safety', focus: ['Research'], types: ['501c3', 'non_us'] }
    expect(names(filterOrgs(ORGS, f, 'A–Z'))).toEqual(['Fieldco'])
  })
  test('search looks in the name, summary, cause and focus', () => {
    expect(names(filterOrgs(ORGS, { ...NO_FILTERS, q: 'agents' }, 'A–Z'))).toEqual(['Evalco'])
    expect(names(filterOrgs(ORGS, { ...NO_FILTERS, q: 'BIOSEC' }, 'A–Z'))).toEqual(['Bioco'])
  })
  test('an org with no legal type is left out once a type is picked', () => {
    const all = [...ORGS, org('Newco')]
    expect(names(filterOrgs(all, { ...NO_FILTERS, types: ['501c3'] }, 'A–Z'))).toEqual([
      'Bioco',
      'Evalco',
    ])
  })
})

describe('O12 cause counts say what picking the cause would show', () => {
  test('they follow the other filters, not the chosen cause', () => {
    const f = { ...NO_FILTERS, cause: 'AI safety', focus: ['Research'] }
    expect(causeCounts(ORGS, f, ['AI safety', 'Biosecurity & health'])).toEqual({
      [ALL_CAUSES]: 2,
      'AI safety': 1,
      'Biosecurity & health': 1,
    })
  })
})
