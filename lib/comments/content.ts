import type { JSONContent } from '@tiptap/core'
import { parseMentions } from '@/utils/parse'

// Node and mark types the editor produces (StarterKit, link, mention, image). Anything else in a
// stored document came from a hand-made request, not the editor.
const NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'mention',
  'image',
])
const MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'link'])
const MAX_BYTES = 100_000
const MAX_DEPTH = 20

export type ContentCheck = { ok: true; content: JSONContent } | { ok: false; message: string }

export function checkContent(content: unknown): ContentCheck {
  if (!content || typeof content !== 'object' || (content as JSONContent).type !== 'doc') {
    return { ok: false, message: 'content must be an editor document' }
  }
  if (JSON.stringify(content).length > MAX_BYTES) {
    return { ok: false, message: 'comment is too long' }
  }
  const problem = findProblem(content as JSONContent, 0)
  if (problem) return { ok: false, message: problem }
  if (!hasText(content as JSONContent)) return { ok: false, message: 'comment is empty' }
  return { ok: true, content: content as JSONContent }
}

function findProblem(node: JSONContent, depth: number): string | null {
  if (depth > MAX_DEPTH) return 'content is nested too deeply'
  if (!node.type || !NODE_TYPES.has(node.type)) return `unsupported content: ${node.type}`
  for (const mark of node.marks ?? []) {
    if (!MARK_TYPES.has(mark.type)) return `unsupported formatting: ${mark.type}`
  }
  for (const child of node.content ?? []) {
    const p = findProblem(child, depth + 1)
    if (p) return p
  }
  return null
}

function hasText(node: JSONContent): boolean {
  if (node.type === 'text' && node.text?.trim()) return true
  if (node.type === 'mention' || node.type === 'image') return true
  return (node.content ?? []).some(hasText)
}

export const mentionIds = (content: JSONContent) => parseMentions(content)
