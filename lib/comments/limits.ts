import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { sendDiscordAlert } from '@/utils/discord'
import { log } from '@/lib/log'
import { denied, type Denied, type Target } from './types'

// Rate limits (C9, the user 2026-09-30; project/program and report numbers proposed by Claude):
// a short window that refuses, and a daily count past which admins get a warning (not a refusal).
// Refusals say which limit and when to try again.
const WINDOW_MINUTES = 5
const LIMITS = {
  profile: { perWindow: 5, warnPerDay: 10, what: 'comments on profiles' },
  project: { perWindow: 10, warnPerDay: 30, what: 'comments on projects and programs' },
  report: { perWindow: 5, warnPerDay: 10, what: 'reports' },
} as const
type Bucket = keyof typeof LIMITS

export const bucketFor = (target: Target): Bucket =>
  'profile_id' in target ? 'profile' : 'project'

// null when allowed; otherwise a 429 saying which limit and when to retry.
export async function checkRate(authorId: string, bucket: Bucket): Promise<Denied | null> {
  const limit = LIMITS[bucket]
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_MINUTES * 60_000).toISOString()
  const dayStart = new Date(now - 24 * 3600_000).toISOString()

  const recent = await timestamps(authorId, bucket, windowStart)
  if (recent.length >= limit.perWindow) {
    const oldest = new Date(recent[0]).getTime()
    const waitSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MINUTES * 60_000 - now) / 1000))
    const when =
      waitSeconds < 90 ? `${waitSeconds} seconds` : `${Math.ceil(waitSeconds / 60)} minutes`
    log.warn('comment.rate_limited', { author: authorId, bucket, recent: recent.length })
    return denied(
      429,
      `You've reached the limit of ${limit.perWindow} ${limit.what} per ${WINDOW_MINUTES} minutes. ` +
        `Your text is kept: try again in ${when}.`
    )
  }

  // The daily warning fires once, on the post that goes past the threshold.
  const today = await timestamps(authorId, bucket, dayStart)
  if (today.length === limit.warnPerDay) {
    const message = `Unusual activity: a user passed ${limit.warnPerDay} ${limit.what} in a day (${authorId})`
    log.warn('comment.daily_threshold', { author: authorId, bucket, count: today.length + 1 })
    await sendDiscordAlert(message)
  }
  return null
}

async function timestamps(authorId: string, bucket: Bucket, since: string) {
  const admin = createAdminClient()
  const query =
    bucket === 'report'
      ? admin.from('comment_reports').select('created_at').eq('reporter_id', authorId)
      : bucket === 'profile'
        ? admin
            .from('comments')
            .select('created_at')
            .eq('commenter', authorId)
            .not('profile_id', 'is', null)
        : admin
            .from('comments')
            .select('created_at')
            .eq('commenter', authorId)
            .or('project.not.is.null,cause_slug.not.is.null')
  const { data } = await query.gte('created_at', since).order('created_at').throwOnError()
  return (data ?? []).map((r: { created_at: string }) => r.created_at)
}
