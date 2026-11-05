import { createAdminClient } from '@/db/supabase-admin'
import { ACCOUNT_MODERATION_ENABLED } from '@/utils/constants'

// Whether an account is held (U4), without the classifier, so edge and Pages routes can use it.
// The database trigger refuse_held_projects is the backstop for project writes from the browser.

export const HELD_MESSAGE =
  'Your account is pending review by the Manifund team, so you can’t post yet. Contact hi@manifund.org with questions.'

export const isOpenHold = (h: { held_at: string | null; cleared_at: string | null } | null) =>
  !!h?.held_at && !h.cleared_at

// The current names differ from the ones last checked (or were never checked): check again (U3).
export function isStale(
  profile: { username: string; full_name: string | null },
  hold: { checked_username: string; checked_full_name: string | null } | null
) {
  return (
    !hold ||
    hold.checked_username !== profile.username ||
    (hold.checked_full_name ?? '') !== (profile.full_name ?? '')
  )
}

export async function isHeld(profileId: string): Promise<boolean> {
  if (!ACCOUNT_MODERATION_ENABLED) return false
  const { data } = await createAdminClient()
    .from('account_holds')
    .select('held_at, cleared_at')
    .eq('profile_id', profileId)
    .maybeSingle()
  return isOpenHold(data)
}
