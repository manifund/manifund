import { createAdminClient } from '@/db/supabase-admin'
import { denied, type CommentRow, type Recipient, type Target, type TargetRules } from '../types'

export type ProjectContext = {
  id: string
  title: string
  slug: string
  creator: string
  stage: string
}

// Kinds only the project's creator may post, and only as a new thread.
const CREATOR_KINDS = ['progress update', 'final report']

export const projectRules: TargetRules<ProjectContext> = {
  async load(target: Target) {
    const { data } = await createAdminClient()
      .from('projects')
      .select('id, title, slug, creator, stage')
      .eq('id', target.project)
      .maybeSingle()
      .throwOnError()
    return data
  },

  canPost(ctx, author, { kind, parent }) {
    if (ctx.stage === 'hidden' || ctx.stage === 'draft') {
      return denied(403, 'this project is not open for comments')
    }
    if (kind && CREATOR_KINDS.includes(kind) && author.id !== ctx.creator) {
      return denied(403, `only the project's creator can post a ${kind}`)
    }
    if (kind && parent) return denied(400, 'replies are plain comments')
    return { ok: true }
  },

  async recipients(ctx, comment, mentions, parent) {
    const out: Recipient[] = [{ id: ctx.creator, reason: 'comment_on_your_project' }]
    if (parent) out.push({ id: parent.commenter, reason: 'reply_to_you' })
    for (const id of mentions) out.push({ id, reason: 'mention' })
    if (!comment.replying_to) {
      const { data: follows } = await createAdminClient()
        .from('project_follows')
        .select('follower_id')
        .eq('project_id', ctx.id)
        .throwOnError()
      const reason =
        comment.special_type === 'progress update'
          ? 'progress_update'
          : comment.special_type === 'final report'
            ? 'final_report'
            : 'followed_project_comment'
      for (const f of follows ?? []) out.push({ id: f.follower_id, reason })
    }
    return out
  },

  label(ctx) {
    return { title: ctx.title, href: `/projects/${ctx.slug}?tab=comments` }
  },

  // Commenting on a project follows it (as before). Idempotent: following twice is fine.
  async afterPost(ctx, comment: CommentRow) {
    await createAdminClient()
      .from('project_follows')
      .upsert(
        { project_id: ctx.id, follower_id: comment.commenter },
        { onConflict: 'project_id,follower_id', ignoreDuplicates: true }
      )
      .throwOnError()
  },
}
