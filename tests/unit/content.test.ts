import { describe, expect, test } from 'bun:test'
import { checkContent, countWords, mentionIds } from '@/lib/comments/content'
import { doc, docWithMention, words } from '../helpers/content'

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
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'onclick' }] }] }],
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
