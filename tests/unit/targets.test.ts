import { describe, expect, test } from 'bun:test'
import { parseTarget, targetOf } from '@/lib/comments/targets'
import { commentHref, isListed, targetTitle } from '@/lib/comments/links'

describe('C1 a comment is about exactly one thing', () => {
  test('a target from a request names exactly one known column', () => {
    expect(parseTarget({ project: 'p1' })).toEqual({ project: 'p1' })
    expect(parseTarget({ profile_id: 'u1' })).toEqual({ profile_id: 'u1' })
  })
  test('anything else is refused', () => {
    expect(parseTarget({ projects: 'p1' })).toBeNull()
    expect(parseTarget({ project: 'p1', profile_id: 'u1' })).toBeNull()
    expect(parseTarget({ cause_slug: 'falcon-fund' })).toBeNull()
    expect(parseTarget({ project: '' })).toBeNull()
    expect(parseTarget({ project: 5 })).toBeNull()
    expect(parseTarget(null)).toBeNull()
  })
  test('a stored comment gives back its target', () => {
    expect(targetOf({ project: 'p1', profile_id: null })).toEqual({ project: 'p1' })
    expect(targetOf({ project: null, profile_id: 'u1' })).toEqual({ profile_id: 'u1' })
  })
})

describe('C30 C31 where a comment links to, and what it is on', () => {
  test('project and profile comments link to their page and anchor', () => {
    expect(commentHref({ id: 'c1', projects: { title: 'T', slug: 'p' } })).toBe('/projects/p?tab=comments#c1')
    expect(commentHref({ id: 'c1', target_profile: { username: 'maya', full_name: 'Maya' } })).toBe('/maya#c1')
  })
  test('labels say where it was posted', () => {
    expect(targetTitle({ projects: { title: 'Better evals', slug: 'x' } })).toBe('Better evals')
    expect(targetTitle({ target_profile: { username: 'maya', full_name: 'Maya Reyes' } })).toBe(
      "Maya Reyes's profile"
    )
    expect(targetTitle({ target_profile: { username: 'maya', full_name: '' } })).toBe("maya's profile")
  })
  test('comments on hidden projects stay out of lists; other targets are listed', () => {
    expect(isListed({ project: 'p', projects: { title: '', slug: '', stage: 'hidden' } })).toBe(false)
    expect(isListed({ project: 'p', projects: { title: '', slug: '', stage: 'active' } })).toBe(true)
    expect(isListed({ project: null, target_profile: { username: 'm', full_name: '' } })).toBe(true)
  })
})
