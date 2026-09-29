import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/db/supabase-admin'
import type { Profile } from '@/db/profile'
import { log } from '@/lib/log'
import { checkContent, mentionIds } from './content'
import { recordCommentNotifications } from '@/lib/notifications/record'
import { sendPendingEmails } from '@/lib/notifications/send'
import { rulesFor } from './targets'
import { denied, USER_KINDS, type CommentRow, type PostInput, type Result } from './types'

export * from './types'

// The only code that writes comments. Routes and server code paths call these; the database
// refuses direct writes from browsers (in production; locally the old open policy remains).
//
// source 'user': a person through the public route; only USER_KINDS are allowed.
// source 'server': a server flow (final report, grant rationale, admin note) that has already
// checked who the caller is.
export async function post(
  author: Profile,
  input: PostInput,
  source: 'user' | 'server' = 'user'
): Promise<Result<{ comment: CommentRow }>> {
  const kind = input.kind ?? null
  if (source === 'user' && !USER_KINDS.includes(kind)) {
    return denied(400, `comments of kind "${kind}" can't be posted directly`)
  }
  const checked = checkContent(input.content)
  if (!checked.ok) return denied(400, checked.message)

  const rules = rulesFor(input.target)
  const ctx = await rules.load(input.target)
  if (!ctx) return denied(404, 'nothing to comment on')

  // Replying to a reply answers its thread: the reply goes under the top-level comment
  // (the composer already starts it with an @mention of the person being answered).
  let parent: CommentRow | undefined
  if (input.replyingTo) {
    parent = (await getComment(input.replyingTo)) ?? undefined
    if (parent?.replying_to) parent = (await getComment(parent.replying_to)) ?? undefined
    if (!parent) return denied(404, 'the comment you are replying to is gone')
  }

  const verdict = rules.canPost(ctx, author, { kind, parent })
  if (!verdict.ok) return verdict

  const { data: comment, error } = await createAdminClient()
    .from('comments')
    .insert({
      ...input.target,
      commenter: author.id,
      content: checked.content,
      special_type: kind,
      replying_to: parent?.id ?? null,
    })
    .select()
    .single()
  if (error || !comment) {
    // The database rules (threading trigger, foreign keys) are the backstop for the checks above.
    log.error('comment.insert_failed', { target: input.target, author: author.id, error })
    return denied(400, error?.message ?? 'could not save the comment')
  }
  log.info('comment.posted', { comment_id: comment.id, target: input.target, kind, source })

  try {
    await rules.afterPost?.(ctx, comment)
  } catch (e) {
    log.warn('comment.after_post_failed', { comment_id: comment.id, error: e })
  }
  await notify(rules, ctx, comment, parent)
  return { ok: true, comment }
}

// Record who hears about the comment, then email them after the response is sent (the backup
// sweep sends whatever this misses). Failures are logged, never returned: the comment stands.
async function notify(
  rules: ReturnType<typeof rulesFor>,
  ctx: unknown,
  comment: CommentRow,
  parent?: CommentRow
) {
  try {
    const recipients = await rules.recipients(
      ctx,
      comment,
      mentionIds(comment.content as any),
      parent
    )
    await recordCommentNotifications(comment, recipients)
  } catch (e) {
    log.error('comment.notify_failed', { comment_id: comment.id, error: e })
    return
  }
  try {
    after(() => sendPendingEmails({ commentId: comment.id }))
  } catch (e) {
    // Outside a request (a script): the sweep sends them.
    log.warn('comment.send_deferred', { comment_id: comment.id, error: e })
  }
}

async function getComment(id: string) {
  const { data } = await createAdminClient()
    .from('comments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .throwOnError()
  return data
}
