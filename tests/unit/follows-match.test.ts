// Saved searches: home's search text and categories (F5), matched against new projects (F6), named from them; and
// the network line's wording (F8).
import { describe, expect, test } from 'bun:test'
import {
  parseSearch,
  searchMatches,
  searchName,
  searchQuery,
  type MatchableProject,
} from '@/lib/follows/match'
import { networkPeople, networkText } from '@/lib/follows/network'

const project = (over: Partial<MatchableProject> = {}): MatchableProject => ({
  title: 'Probe kit for small labs',
  blurb: 'Interpretability tools',
  causes: [{ slug: 'tais' }],
  creatorName: 'AA Priya Raman',
  creatorUsername: 'aa-priya-raman',
  ...over,
})

describe('F5 a saved search is the search text and categories, as home keeps them in the URL', () => {
  test('one query for one search, whatever order the categories were picked in', () => {
    expect(searchQuery({ q: ' probe ', causes: ['tais', 'biosecurity'] })).toBe(
      'q=probe&cause=biosecurity&cause=tais'
    )
    expect(searchQuery(parseSearch('cause=tais&q=probe&cause=biosecurity&tab=projects'))).toBe(
      'q=probe&cause=biosecurity&cause=tais'
    )
    expect(searchQuery({ q: '', causes: [] })).toBe('')
  })
  test('named from the text and the category titles', () => {
    const titles = { tais: 'Technical AI safety', biosecurity: 'Biosecurity' }
    expect(searchName('q=probe&cause=tais&cause=biosecurity', titles)).toBe(
      '"probe" in Biosecurity or Technical AI safety'
    )
    expect(searchName('cause=tais', titles)).toBe('Technical AI safety')
    expect(searchName('q=probe')).toBe('"probe"')
  })
})

describe('F6 a saved search matches new projects as home would show them', () => {
  test('any of its categories', () => {
    expect(searchMatches('cause=tais', project())).toBe(true)
    expect(searchMatches('cause=biosecurity&cause=tais', project())).toBe(true)
    expect(searchMatches('cause=biosecurity', project())).toBe(false)
    expect(searchMatches('cause=tais', project({ causes: [] }))).toBe(false)
  })
  test('search text against title, subtitle and creator', () => {
    expect(searchMatches('q=probe', project())).toBe(true)
    expect(searchMatches('q=interpretability', project())).toBe(true)
    expect(searchMatches('q=priya', project())).toBe(true)
    expect(searchMatches('q=biosecurity', project())).toBe(false)
    expect(searchMatches('q=probe&cause=biosecurity', project())).toBe(false)
  })
  test("an older search's other filters are ignored: it matches more widely, not less", () => {
    expect(searchMatches('cause=tais&amount=over-100k&status=all&network=1', project())).toBe(true)
  })
})

describe('F8 the network line names up to two people, without a label', () => {
  test('wording', () => {
    expect(networkText(undefined)).toBeNull()
    expect(networkText([{ name: 'Maya', kind: 'created' }])).toBeNull()
    expect(networkText([{ name: 'Maya', kind: 'donated' }])).toBe('Maya donated')
    expect(
      networkText([
        { name: 'Maya', kind: 'donated' },
        { name: 'Maya', kind: 'commented' },
        { name: 'Sam', kind: 'offered' },
      ])
    ).toBe('Maya donated and commented, Sam offered')
    expect(
      networkText([
        { name: 'Maya', kind: 'donated' },
        { name: 'Sam', kind: 'commented' },
        { name: 'Ruth', kind: 'offered' },
      ])
    ).toBe('Maya donated, Sam commented and 1 more')
  })
})
