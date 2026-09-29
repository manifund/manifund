import { createAdminClient } from '@/db/supabase-admin'
import { denied, type Recipient, type Target, type TargetRules } from '../types'

export type CauseContext = { slug: string; title: string }

// Comments on a cause, shown from its About tab (asked for 2026-09-28; funds and rounds are causes
// today). Causes have no owner in the schema, so only reply authors and mentioned people hear
// about a comment for now.
export const causeRules: TargetRules<CauseContext> = {
  async load(target: Target) {
    if (!('cause_slug' in target)) return null
    const { data } = await createAdminClient()
      .from('causes')
      .select('slug, title')
      .eq('slug', target.cause_slug)
      .maybeSingle()
      .throwOnError()
    return data
  },

  canPost(_ctx, _author, { kind }) {
    if (kind) return denied(400, 'only plain comments on causes')
    return { ok: true }
  },

  async recipients(_ctx, _comment, mentions, parent) {
    const out: Recipient[] = []
    if (parent) out.push({ id: parent.commenter, reason: 'reply_to_you' })
    for (const id of mentions) out.push({ id, reason: 'mention' })
    return out
  },

  label(ctx) {
    return { title: ctx.title, href: `/causes/${ctx.slug}?tab=about` }
  },
}
