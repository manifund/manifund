// People and profiles' rules that are plain logic (docs/ai-reference/people/README.md).
import { describe, expect, test } from 'bun:test'
import { addHttpToUrl } from '@/utils/formatting'
import { searchInAny } from '@/utils/parse'

describe('E12 a website shows as a link, with https:// added when missing', () => {
  test('a bare domain gets https://', () => {
    expect(addHttpToUrl('ann.example')).toBe('https://ann.example')
    expect(addHttpToUrl('www.ann.example/about')).toBe('https://www.ann.example/about')
  })
  test('a full address is kept', () => {
    expect(addHttpToUrl('https://ann.example')).toBe('https://ann.example')
    expect(addHttpToUrl('http://ann.example')).toBe('http://ann.example')
  })
})

describe('E24 /people search: every word, in the name, the bio or one project title', () => {
  test('every word of the query must be in one field, any case', () => {
    expect(searchInAny('ann lee', 'Ann Lee', 'bio')).toBe(true)
    expect(searchInAny('ANN', 'Ann Lee')).toBe(true)
    expect(searchInAny('ann smith', 'Ann Lee', 'Smith works on evals')).toBe(false)
  })
  test('any field can match: name, bio or a project title', () => {
    expect(searchInAny('evals', 'Ann Lee', 'researcher', 'Better evals')).toBe(true)
    expect(searchInAny('forecasting', 'Ann Lee', 'researcher', 'Better evals')).toBe(false)
  })
  test('an empty query keeps everyone', () => {
    expect(searchInAny('', 'Ann Lee', '')).toBe(true)
  })
})
