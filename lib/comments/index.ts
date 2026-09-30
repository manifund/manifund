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

  const verdict = await rules.canPost(ctx, author, { kind, parent })
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

type Actor = { profile: Profile; admin: boolean }

// Edit: the author (their own words; strikethrough etc. for retractions), or a moderator with a
// note (decided with the team 2026-09-30). Every version stays public in the history, with who
// wrote it and the moderator's note. The author is told about a moderator's edit.
export async function edit(
  actor: Actor,
  commentId: string,
  content: unknown,
  note?: string | null
): Promise<Result<{ comment: CommentRow }>> {
  const checked = checkContent(content)
  if (!checked.ok) return denied(400, checked.message)
  const existing = await getComment(commentId)
  if (!existing) return denied(404, 'comment not found')
  if (existing.deleted_at) return denied(409, 'this comment was removed')
  const byAuthor = existing.commenter === actor.profile.id
  if (!byAuthor && !actor.admin) return denied(403, 'only the author or a moderator can edit')
  const modNote = note?.trim().slice(0, 500) || null
  if (!byAuthor && !modNote) return denied(400, "a moderator's edit needs a note")
  const { data: comment, error } = await createAdminClient()
    .from('comments')
    .update({
      content: checked.content,
      edited_by: actor.profile.id,
      edit_note: byAuthor ? null : modNote,
    })
    .eq('id', commentId)
    .select()
    .single()
  if (error || !comment) {
    log.error('comment.edit_failed', { comment_id: commentId, error })
    return denied(500, 'could not save the edit')
  }
  log.info('comment.edited', { comment_id: commentId, by_moderator: !byAuthor })
  if (!byAuthor) await tellAuthor(comment, actor.profile.id)
  return { ok: true, comment }
}

// Remove: moderators only, with a public reason (mostly private information). A placeholder with
// the reason stays; the text leaves public view (its history is admin-only); replies stay.
// Authors can't delete (decided with the team 2026-09-30): they edit instead.
export async function remove(
  actor: Actor,
  commentId: string,
  reason?: string | null
): Promise<Result> {
  if (!actor.admin)
    return denied(403, 'only moderators can remove a comment; you can edit it instead')
  const modNote = reason?.trim().slice(0, 500)
  if (!modNote) return denied(400, 'a removal needs a reason, shown in place of the comment')
  const existing = await getComment(commentId)
  if (!existing) return denied(404, 'comment not found')
  if (existing.deleted_at) return { ok: true } // already removed: idempotent
  const { data: comment, error } = await createAdminClient()
    .from('comments')
    .update({
      content: null,
      deleted_at: new Date().toISOString(),
      deleted_by: actor.profile.id,
      removed_reason: modNote,
    })
    .eq('id', commentId)
    .select()
    .single()
  if (error || !comment) {
    log.error('comment.remove_failed', { comment_id: commentId, error })
    return denied(500, 'could not remove the comment')
  }
  // Nobody needs an email about a comment that is gone, except its author.
  await createAdminClient()
    .from('notifications')
    .update({ email_status: 'skipped', last_error: 'comment removed' })
    .eq('comment_id', commentId)
    .in('email_status', ['pending'])
  log.info('comment.removed', { comment_id: commentId })
  await tellAuthor(comment, actor.profile.id)
  return { ok: true }
}

async function tellAuthor(comment: CommentRow, moderatorId: string) {
  await recordCommentNotifications(
    comment,
    [{ id: comment.commenter, reason: 'moderated_your_comment' }],
    moderatorId
  )
  try {
    after(() => sendPendingEmails({ commentId: comment.id }))
  } catch (e) {
    log.warn('comment.send_deferred', { comment_id: comment.id, error: e })
  }
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
  admin: Actor,
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
