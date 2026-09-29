import 'server-only'
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import { escapeHtml, TEMPLATE_IDS } from '@/utils/email'
import type { Reason } from '@/lib/comments/types'

// Server-safe editor extensions (components/editor is a client module).
const EXTENSIONS = [StarterKit, Link, Image, Mention]
const EXCERPT_WORD_LIMIT = 500

export type EmailInput = {
  reason: Reason
  content: JSONContent
  commenter: { username: string; avatar_url: string | null }
  target: { title: string; url: string } // url: absolute, to the comment
}
export type Email = { templateId: number; model: Record<string, unknown> }

// Reason → Postmark template and variables. Reuses today's templates (NEW_COMMENT,
// COMMENT_WITH_MENTION, GENERIC_NOTIF_HTML) so the emails look the same as before.
export function emailFor({ reason, content, commenter, target }: EmailInput): Email {
  const title = escapeHtml(target.title)
  const commentVars = {
    projectTitle: target.title,
    projectUrl: target.url,
    commenterUsername: commenter.username,
    commenterAvatarUrl: commenter.avatar_url,
    htmlContent: generateHTML(content, EXTENSIONS),
  }
  const generic = (intro: string, buttonText: string, subject: string): Email => ({
    templateId: TEMPLATE_IDS.GENERIC_NOTIF_HTML,
    model: {
      htmlContent: `<p>${intro}</p><hr />${excerptHtml(content)}`,
      buttonUrl: target.url,
      buttonText,
      subject,
    },
  })
  switch (reason) {
    case 'mention':
      return { templateId: TEMPLATE_IDS.COMMENT_WITH_MENTION, model: commentVars }
    case 'progress_update':
      return generic(
        `The creator of "${title}" has posted a progress update on their project:`,
        'View update',
        `Manifund: Update posted for "${target.title}"`
      )
    case 'final_report':
      return generic(
        `The creator of "${title}" has completed their project and posted a final report:`,
        'View report',
        `Manifund: Final report posted for "${target.title}"`
      )
    case 'comment_on_your_profile':
      return generic(
        `${escapeHtml(commenter.username)} commented on your profile:`,
        'View comment',
        `Manifund: ${commenter.username} commented on your profile`
      )
    default: // reply_to_you, comment_on_your_project, followed_project_comment
      return { templateId: TEMPLATE_IDS.NEW_COMMENT, model: commentVars }
  }
}

// The first ~500 words, cut at top-level node boundaries to keep the markup valid.
function excerptHtml(content: JSONContent) {
  const nodes = content.content ?? []
  const kept: JSONContent[] = []
  let words = 0
  for (const node of nodes) {
    kept.push(node)
    words += countWords(node)
    if (words >= EXCERPT_WORD_LIMIT) break
  }
  const html = generateHTML({ type: 'doc', content: kept }, EXTENSIONS)
  return kept.length < nodes.length ? html + '<p><em>[...]</em></p>' : html
}

function countWords(node: JSONContent): number {
  const own = node.text ? node.text.split(/\s+/).filter(Boolean).length : 0
  return own + (node.content ?? []).reduce((sum, child) => sum + countWords(child), 0)
}
