import { describe, expect, test } from 'bun:test'
import { checkContent, countWords, disguisedLink, mentionIds } from '@/lib/comments/content'
import { doc, docWithLink, docWithMention, words } from '../helpers/content'

describe('C4 what a comment can contain', () => {
  test('accepts what the editor produces', () => {
    expect(checkContent(doc('Looks promising, how will you measure it?')).ok).toBe(true)
  })
  test('accepts a mention on its own', () => {
    expect(checkContent(docWithMention('u1', 'maya', '')).ok).toBe(true)
  })
  test('refuses an empty comment or only spaces', () => {
    expect(checkContent(doc('')).ok).toBe(false)
    expect(checkContent(doc('   ')).ok).toBe(false)
  })
  test('refuses anything that is not an editor document', () => {
    expect(checkContent('hello').ok).toBe(false)
    expect(checkContent({ type: 'paragraph' }).ok).toBe(false)
    expect(checkContent(null).ok).toBe(false)
  })
  test('refuses nodes and marks the editor never makes', () => {
    expect(checkContent({ type: 'doc', content: [{ type: 'script' }] }).ok).toBe(false)
    const styled = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'onclick' }] }] },
      ],
    }
    expect(checkContent(styled).ok).toBe(false)
  })
  test('refuses deeply nested documents', () => {
    let node: any = { type: 'paragraph', content: [{ type: 'text', text: 'deep' }] }
    for (let i = 0; i < 25; i++) node = { type: 'blockquote', content: [node] }
    expect(checkContent({ type: 'doc', content: [node] }).ok).toBe(false)
  })
  test('refuses documents over 300 KB', () => {
    expect(checkContent(doc('x'.repeat(310_000))).ok).toBe(false)
  })
  test('refuses more than 10,000 words, saying how many', () => {
    expect(checkContent(doc(words(10_000))).ok).toBe(true) // the size cap doesn't bite first
    const r = checkContent(doc(words(10_001)))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('10,001')
  })
  test('a mention counts as one word', () => {
    expect(countWords(docWithMention('u1', 'maya', 'thanks for this'))).toBe(4)
  })
})

describe('C37 links cannot disguise where they go', () => {
  test('refuses the userinfo trick, naming the decoy and the real host', () => {
    const r = checkContent(docWithLink('https://manifund.org@share.google/dtG6j79T'))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toContain('manifund.org')
      expect(r.message).toContain('share.google')
    }
  })
  test('refuses it with a password, protocol-relative, or backslashes', () => {
    expect(checkContent(docWithLink('https://manifund.org:pw@evil.example/x')).ok).toBe(false)
    expect(checkContent(docWithLink('//manifund.org@evil.example/x')).ok).toBe(false)
    expect(checkContent(docWithLink('https:\\\\manifund.org@evil.example/x')).ok).toBe(false)
  })
  test('refuses it when the authority is only an @', () => {
    expect(checkContent(docWithLink('https://@evil.example/x')).ok).toBe(false)
    expect(checkContent(docWithLink('https://manifund.org@')).ok).toBe(false)
  })
  test('accepts ordinary links', () => {
    expect(checkContent(docWithLink('https://manifund.org/projects/x?tab=comments#y')).ok).toBe(
      true
    )
    expect(checkContent(docWithLink('http://localhost:3000/x')).ok).toBe(true)
    expect(checkContent(docWithLink('/projects/relative')).ok).toBe(true)
    expect(checkContent(docWithLink('https://share.google/dtG6j79T')).ok).toBe(true)
  })
  test('accepts a mailto: whose address contains an @', () => {
    expect(checkContent(docWithLink('mailto:austin@manifund.org')).ok).toBe(true)
  })
  test('an @ in the path or query is not the trick', () => {
    expect(checkContent(docWithLink('https://manifund.org/u/@maya')).ok).toBe(true)
    expect(checkContent(docWithLink('https://manifund.org/x?to=a@b.com')).ok).toBe(true)
  })
  test('the helper reports the two hosts', () => {
    expect(disguisedLink('https://manifund.org@evil.example/x')).toEqual({
      decoy: 'manifund.org',
      host: 'evil.example',
    })
    expect(disguisedLink('https://manifund.org/x')).toBeNull()
    expect(disguisedLink(null)).toBeNull()
  })
})

describe('C21 mentions are read from the document', () => {
  test('collects each mentioned person once', () => {
    const d = {
      type: 'doc',
      content: [
        ...docWithMention('u1', 'maya', 'hi').content!,
        ...docWithMention('u2', 'tomas', 'and').content!,
        ...docWithMention('u1', 'maya', 'again').content!,
      ],
    }
    expect(mentionIds(d).sort()).toEqual(['u1', 'u2'])
  })
})
