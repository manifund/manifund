import { createAdminClient } from '@/db/supabase-admin'
import { denied, type Recipient, type Target, type TargetRules } from '../types'

export type ProfileContext = { id: string; username: string; name: string; type: string }

// Comments on people's profiles (asked for 2026-09-26/28): anyone signed in may comment, there is
// no off switch (a report button goes to the admins instead), the person can reply but not start a
// thread on their own profile, system accounts take no comments. Agents may not comment on people
// (decided 2026-09-28): enforced once profiles carry an agent flag (not in the schema yet).
const DAILY_CAP = 10

export const profileRules: TargetRules<ProfileContext> = {
  async load(target: Target) {
    if (!('profile_id' in target)) return null
    const { data } = await createAdminClient()
      .from('profiles')
      .select('id, username, full_name, type')
      .eq('id', target.profile_id)
      .maybeSingle()
      .throwOnError()
    return data
      ? {
          id: data.id,
          username: data.username,
          name: data.full_name || data.username,
          type: data.type,
        }
      : null
  },

  async canPost(ctx, author, { kind, parent }) {
    if (ctx.type !== 'individual' && ctx.type !== 'org') {
      return denied(403, 'this profile does not take comments')
    }
    if (kind) return denied(400, 'only plain comments on profiles')
    if (author.id === ctx.id && !parent) {
      return denied(403, 'you can reply to comments on your own profile, but not start a thread')
    }
    // A per-person daily cap: comments about people are where abuse would hurt most.
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { count } = await createAdminClient()
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('commenter', author.id)
      .not('profile_id', 'is', null)
      .gte('created_at', since)
    if ((count ?? 0) >= DAILY_CAP) {
      return denied(429, `at most ${DAILY_CAP} comments on profiles per day`)
    }
    return { ok: true }
  },

  async recipients(ctx, comment, mentions, parent) {
    const out: Recipient[] = [{ id: ctx.id, reason: 'comment_on_your_profile' }]
    if (parent) out.push({ id: parent.commenter, reason: 'reply_to_you' })
    for (const id of mentions) out.push({ id, reason: 'mention' })
    return out
  },

  label(ctx) {
    return { title: `${ctx.name}'s profile`, href: `/${ctx.username}` }
  },
}
