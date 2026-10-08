import { createAdminClient } from '@/db/supabase-admin'
import { denied, type Recipient, type Target, type TargetRules } from '../types'

export type OrgContext = { id: string; slug: string; name: string }

// Reviews of an organization (docs/product/orgs/README.md): anyone signed in may write one or reply.
// An org page has no owner yet (claiming is planned), so nobody is told about a new review; replies
// and mentions notify as everywhere else. Rate limits: lib/comments/limits.ts.

export const orgRules: TargetRules<OrgContext> = {
  async load(target: Target) {
    if (!('org_id' in target)) return null
    const { data } = await createAdminClient()
      .from('orgs')
      .select('id, slug, name')
      .eq('id', target.org_id)
      .maybeSingle()
      .throwOnError()
    return data
  },

  canPost(_ctx, _author, { type }) {
    if (type) return denied(400, 'only plain comments on organizations (no type)')
    return { ok: true }
  },

  recipients(_ctx, _comment, mentions, parent) {
    const out: Recipient[] = []
    if (parent) out.push({ id: parent.commenter, reason: 'reply_to_you' })
    for (const id of mentions) out.push({ id, reason: 'mention' })
    return Promise.resolve(out)
  },

  label(ctx) {
    return { title: ctx.name, href: `/orgs/${ctx.slug}#reviews` }
  },
}
