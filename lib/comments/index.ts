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
    if (parent.deleted_at) return denied(409, 'this thread was deleted')
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

// Edit: only the author, only a visible comment. The database keeps the old version.
export async function edit(
  author: Profile,
  commentId: string,
  content: unknown
): Promise<Result<{ comment: CommentRow }>> {
  const checked = checkContent(content)
  if (!checked.ok) return denied(400, checked.message)
  const existing = await getComment(commentId)
  if (!existing) return denied(404, 'comment not found')
  if (existing.commenter !== author.id) return denied(403, 'only the author can edit a comment')
  if (existing.deleted_at) return denied(409, 'this comment was deleted')
  const { data: comment, error } = await createAdminClient()
    .from('comments')
    .update({ content: checked.content })
    .eq('id', commentId)
    .select()
    .single()
  if (error || !comment) {
    log.error('comment.edit_failed', { comment_id: commentId, error })
    return denied(500, 'could not save the edit')
  }
  log.info('comment.edited', { comment_id: commentId })
  return { ok: true, comment }
}

// Remove: the author ("deleted by the author") or an admin ("removed by an admin: <reason>").
// Every removal leaves a placeholder; the text stays only in revisions, which the public can't
// read for removed comments. Replies stay.
export async function remove(
  actor: { profile: Profile; admin: boolean },
  commentId: string,
  reason?: string | null
): Promise<Result> {
  const existing = await getComment(commentId)
  if (!existing) return denied(404, 'comment not found')
  if (existing.deleted_at) return { ok: true } // already removed: idempotent
  const byAuthor = existing.commenter === actor.profile.id
  if (!byAuthor && !actor.admin)
    return denied(403, 'only the author or an admin can remove a comment')
  if (!byAuthor && !reason?.trim()) return denied(400, 'an admin removal needs a reason')
  const { error } = await createAdminClient()
    .from('comments')
    .update({
      content: null,
      deleted_at: new Date().toISOString(),
      deleted_by: actor.profile.id,
      removed_reason: byAuthor ? null : reason!.trim(),
    })
    .eq('id', commentId)
  if (error) {
    log.error('comment.remove_failed', { comment_id: commentId, error })
    return denied(500, 'could not remove the comment')
  }
  // Nobody needs an email about a comment that is gone.
  await createAdminClient()
    .from('notifications')
    .update({ email_status: 'skipped', last_error: 'comment removed' })
    .eq('comment_id', commentId)
    .in('email_status', ['pending'])
  log.info('comment.removed', { comment_id: commentId, by_author: byAuthor })
  return { ok: true }
}

// Report to the admins: once per person per comment, not your own, optional note, spam toggle.
export async function report(
  reporter: Profile,
  commentId: string,
  input: { isSpam?: boolean; note?: string | null }
): Promise<Result> {
  const existing = await getComment(commentId)
  if (!existing || existing.deleted_at) return denied(404, 'comment not found')
  if (existing.commenter === reporter.id) return denied(400, "you can't report your own comment")
  const note = input.note?.trim().slice(0, 2000) || null
  const { error } = await createAdminClient().from('comment_reports').insert({
    comment_id: commentId,
    reporter_id: reporter.id,
    is_spam: !!input.isSpam,
    note,
  })
  if (error?.code === '23505') return denied(409, 'you already reported this comment')
  if (error) {
    log.error('comment.report_failed', { comment_id: commentId, error })
    return denied(500, 'could not send the report')
  }
  log.warn('comment.reported', { comment_id: commentId, is_spam: !!input.isSpam })
  return { ok: true }
}

// An admin closes every open report on a comment: dismiss, or remove the comment with a reason.
export async function resolveReports(
  admin: { profile: Profile; admin: boolean },
  commentId: string,
  resolution: 'dismissed' | 'removed',
  reason?: string | null
): Promise<Result> {
  if (!admin.admin) return denied(403, 'admins only')
  if (resolution === 'removed') {
    const removed = await remove(admin, commentId, reason)
    if (!removed.ok) return removed
  }
  const { error } = await createAdminClient()
    .from('comment_reports')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: admin.profile.id,
      resolution,
    })
    .eq('comment_id', commentId)
    .is('resolved_at', null)
  if (error) return denied(500, 'could not close the reports')
  log.info('comment.reports_resolved', { comment_id: commentId, resolution })
  return { ok: true }
}
