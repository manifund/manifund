import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { ADMINS, type Profile } from '@/db/profile'
import { classifyAccount, CATEGORY_LABELS, hasModerationKeys } from '@/app/utils/ai-moderation'
import { sendDiscordAlert } from '@/utils/discord'
import { ACCOUNT_MODERATION_ENABLED } from '@/utils/constants'
import { log } from '@/lib/log'
import { denied, type Denied } from '@/lib/comments/types'
import { HELD_MESSAGE, isOpenHold as isOpen, isStale } from '@/lib/account-hold-status'

export { HELD_MESSAGE, isHeld } from '@/lib/account-hold-status'

// Account holds (docs/product/people U2-U6): a new account whose username or display name looks like
// impersonation or is offensive can't post projects or comments until an admin clears or bans it.

// "Manifund" in a name that isn't the team's is held without asking the model (the 2026-11-04
// "Manifund_Support" phishing account).
const STAFF_NAME = /manifund|trust\s*(&|and)?\s*safety/i

type Hold = {
  checked_username: string
  checked_full_name: string | null
  held_at: string | null
  cleared_at: string | null
}

async function getHold(profileId: string): Promise<Hold | null> {
  const { data } = await createAdminClient()
    .from('account_holds')
    .select('checked_username, checked_full_name, held_at, cleared_at')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data
}

async function teamNames(): Promise<string[]> {
  const admin = createAdminClient()
  const { data: users } = await admin.from('users').select('id').in('email', ADMINS)
  const ids = (users ?? []).map((u) => u.id).filter((id): id is string => !!id)
  if (!ids.length) return []
  const { data: profiles } = await admin.from('profiles').select('full_name').in('id', ids)
  return (profiles ?? []).map((p) => p.full_name).filter(Boolean)
}

// Classify the account's names and record the result. A flag opens a hold (unless an admin already
// cleared these exact names) and alerts the admins. Fails open: a classifier outage never holds.
export async function checkAccount(
  profile: Pick<Profile, 'id' | 'username' | 'full_name'>,
  isAdminAccount = false
): Promise<void> {
  if (!ACCOUNT_MODERATION_ENABLED || isAdminAccount) return
  const existing = await getHold(profile.id)
  if (!isStale(profile, existing)) return

  const names = `${profile.username} ${profile.full_name ?? ''}`
  const verdict = STAFF_NAME.test(names)
    ? {
        flagged: true,
        categories: ['impersonation'],
        reason: 'name presents as Manifund staff',
        model: 'rule',
      }
    : hasModerationKeys()
      ? await classifyAccount({
          username: profile.username,
          fullName: profile.full_name,
          teamNames: await teamNames(),
        })
      : null

  const admin = createAdminClient()
  const checked = {
    profile_id: profile.id,
    checked_username: profile.username,
    checked_full_name: profile.full_name,
    checked_at: new Date().toISOString(),
  }
  if (!verdict?.flagged) {
    // Not flagged (or unavailable): record the names so they aren't checked again, keeping any open hold.
    await admin.from('account_holds').upsert(checked)
    return
  }
  await admin.from('account_holds').upsert({
    ...checked,
    held_at: new Date().toISOString(),
    reason: verdict.reason,
    categories: verdict.categories,
    model: verdict.model,
    cleared_at: null,
    cleared_by: null,
  })
  log.warn('account.held', { profile_id: profile.id, categories: verdict.categories })
  await sendDiscordAlert(
    `🚩 Account held for review: @${profile.username} ("${profile.full_name ?? ''}") — ${verdict.categories
      .map((c) => CATEGORY_LABELS[c] ?? c)
      .join(', ')}: ${verdict.reason}\nhttps://manifund.org/admin/held-accounts`
  )
}

// For server paths that create content: refuse a held account. Re-checks first when the names have
// changed since the last check (a rename happens in the browser, so this is where it gets caught).
export async function assertNotHeld(
  profile: Pick<Profile, 'id' | 'username' | 'full_name'>,
  isAdminAccount = false
): Promise<Denied | null> {
  if (!ACCOUNT_MODERATION_ENABLED || isAdminAccount) return null
  let hold = await getHold(profile.id)
  if (isStale(profile, hold)) {
    try {
      await checkAccount(profile)
      hold = await getHold(profile.id)
    } catch (e) {
      log.error('account.check_failed', { profile_id: profile.id, error: e })
    }
  }
  return isOpen(hold) ? denied(403, HELD_MESSAGE) : null
}

export async function resolveHold(
  actor: { profile: Profile; admin: boolean },
  profileId: string,
  action: 'clear' | 'ban'
): Promise<{ ok: true } | Denied> {
  if (!actor.admin) return denied(403, 'admins only')
  const admin = createAdminClient()
  if (action === 'ban') {
    const { superbanUser } = await import('@/db/superban')
    await superbanUser(admin, profileId)
    log.warn('account.banned_from_hold', { profile_id: profileId })
    return { ok: true }
  }
  const { error } = await admin
    .from('account_holds')
    .update({ cleared_at: new Date().toISOString(), cleared_by: actor.profile.id })
    .eq('profile_id', profileId)
  if (error) return denied(500, 'could not clear the hold')
  log.info('account.hold_cleared', { profile_id: profileId })
  return { ok: true }
}
