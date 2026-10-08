import type { JSONContent } from '@tiptap/core'
import type { Database } from '@/db/database.types'
import type { Profile } from '@/db/profile'

export type CommentRow = Database['public']['Tables']['comments']['Row']

// A target is the column that stores it, with its value: spread it into an insert, pass it to
// .match() to read. One variant per commentable thing.
export type Target = { project: string } | { profile_id: string } | { org_id: string }

// `special_type` in the database; null = a plain comment.
export type CommentType = Database['public']['Enums']['comment_type'] | null

// Types a person may post through the public route. The others (final report, grant rationale,
// admin note) are posted by server code paths only, with source 'server'.
export const USER_TYPES: CommentType[] = [null, 'progress update']

export type PostInput = {
  target: Target
  content: JSONContent
  type?: CommentType
  replyingTo?: string | null
}

export type Denied = { ok: false; status: 400 | 403 | 404 | 409 | 429 | 500; message: string }
export type Result<T = {}> = ({ ok: true } & T) | Denied

export const denied = (status: Denied['status'], message: string): Denied => ({
  ok: false,
  status,
  message,
})

// Why someone hears about a comment. When several apply to one person, the earliest in this list
// wins (one notification per person per comment).
export const REASONS = [
  'reply_to_you',
  'mention',
  'comment_on_your_project',
  'comment_on_your_profile',
  'progress_update',
  'final_report',
  'followed_project_comment',
  'moderated_your_comment',
] as const
export type Reason = (typeof REASONS)[number]
// email: false when another email already covers it (e.g. the grant email for a grant rationale);
// the in-app notification is still recorded.
export type Recipient = { id: string; reason: Reason; email?: boolean }

export type TargetRules<C> = {
  // The thing being commented on, with what the rules need (owner ids, title, url); null if gone.
  load(target: Target): Promise<C | null>
  // May this person post this kind here, as a new thread or as a reply to `parent`?
  canPost(
    ctx: C,
    author: Profile,
    input: { type: CommentType; parent?: CommentRow }
  ): Result | Promise<Result>
  // Who hears about a new comment (used from step 2 on; today the webhook still emails).
  recipients(
    ctx: C,
    comment: CommentRow,
    mentions: string[],
    parent?: CommentRow
  ): Promise<Recipient[]>
  // How to name it: email subjects, "on Maya's profile" tags, links.
  label(ctx: C): { title: string; href: string }
  // Target-specific side effects after a post (projects: the author follows the project).
  afterPost?(ctx: C, comment: CommentRow): Promise<void>
}
