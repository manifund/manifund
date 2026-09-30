import { createAdminClient } from '@/db/supabase-admin'
import { isProgram } from '@/db/cause'
import { denied, type Recipient, type Target, type TargetRules } from '../types'

export type CauseContext = { slug: string; title: string; prize: boolean; fund_id: string | null }

// Comments on a program (Falcon Fund, prize rounds, ACX Grants), shown from its About tab (asked for
// 2026-09-28; only programs, not topic categories, 2026-09-30). Programs have no owner in the
// schema, so only reply authors and mentioned people hear about a comment for now.
export const causeRules: TargetRules<CauseContext> = {
  async load(target: Target) {
    if (!('cause_slug' in target)) return null
    const { data } = await createAdminClient()
      .from('causes')
      .select('slug, title, prize, fund_id')
      .eq('slug', target.cause_slug)
      .maybeSingle()
      .throwOnError()
    return data
  },

  canPost(ctx, _author, { kind }) {
    if (!isProgram(ctx))
      return denied(403, 'comments are open on programs and funds, not on topics')
    if (kind) return denied(400, 'only plain comments on programs')
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
