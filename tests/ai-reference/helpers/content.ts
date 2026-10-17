import type { JSONContent } from '@tiptap/core'

// An editor document with one paragraph of text (what the comment box sends).
export const doc = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
})

// A document mentioning someone, then some text.
export const docWithMention = (id: string, label: string, text: string): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'mention', attrs: { id, label } },
        { type: 'text', text: ` ${text}` },
      ],
    },
  ],
})

// n words of filler.
export const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

// A short marker so every row a test file creates can be found and deleted. One per file (each file loads its own
// copy of this module), with a random part: files start at the same moment when they run side by side.
export const RUN = `test-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
