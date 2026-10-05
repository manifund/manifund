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

// A short marker so every row a run creates can be found and deleted.
export const RUN = `test-${Date.now().toString(36)}`
