// No 'server-only' marker: utils/activate-project.ts imports this and is itself imported by client
// components (app/admin/activate-project.tsx), like utils/email.ts. It only works with the
// service-role key, which the browser never has.
import { createAdminClient } from '@/db/supabase-admin'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { groupByKey, type EmailMode, type GroupKey } from './groups'

// A person's stored email modes, by group: overrides only; groups without a row use their default (N3). Raw
// values: groups.ts's effectiveMode treats one that isn't a mode as the default.
export async function loadOverrides(profileId: string): Promise<Partial<Record<string, string>>> {
  const { data, error } = await (createAdminClient() as any)
    .from('notification_settings')
    .select('group_key, email')
    .eq('profile_id', profileId)
  if (error) {
    log.error('notifications.settings_load_failed', { profile_id: profileId, error })
    return {}
  }
  return Object.fromEntries((data ?? []).map((r: any) => [r.group_key, r.email as string]))
}

// The only writer of notification_settings (server-only, N4): the settings page's choices and the unsubscribe
// button's 'off'. Refuses unknown and always-emailed groups. Setting the default removes the override.
export async function setEmailMode(profileId: string, groupKey: string, mode: EmailMode) {
  const group = groupByKey(groupKey)
  if (!group) return { error: `unknown group ${groupKey}` }
  if (group.always) return { error: `${groupKey} is always emailed` }
  const table = (createAdminClient() as any).from('notification_settings')
  const { error } =
    mode === group.default
      ? await table.delete().eq('profile_id', profileId).eq('group_key', groupKey)
      : await table.upsert({
          profile_id: profileId,
          group_key: groupKey,
          email: mode,
          updated_at: new Date().toISOString(),
        })
  if (error) {
    log.error('notifications.settings_save_failed', {
      profile_id: profileId,
      group: groupKey,
      error,
    })
    return { error: 'could not save' }
  }
  log.info('notifications.settings_saved', { profile_id: profileId, group: groupKey, mode })
  return { error: null }
}

// Signed unsubscribe links (N7): profile + the groups the email is about (one, or several for a weekly summary),
// HMAC-signed with a key derived from the service-role key, so no new secret is needed. No expiry: an old
// email's link keeps working.
async function hmac(data: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`notifications-stop:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function stopToken(profileId: string, groupKeys: GroupKey[]) {
  const payload = `${profileId}.${groupKeys.join(',')}`
  return `${payload}.${await hmac(payload)}`
}

export async function readStopToken(token: string) {
  const [profileId, groups, sig] = token.split('.')
  if (!profileId || !groups || !sig) return null
  if ((await hmac(`${profileId}.${groups}`)) !== sig) return null
  return { profileId, groupKeys: groups.split(',') }
}

// Footer links (N7). Optional kinds: "Unsubscribe from these emails" (the groups this email is about) and
// "Choose which emails you receive" (the settings). Always-sent kinds carry none of it: empty links, no headers.
export type EmailLinks = { stopUrl: string; oneClickUrl: string; settingsUrl: string }

export async function emailLinks(profileId: string, groupKeys: GroupKey[]): Promise<EmailLinks> {
  if (groupKeys.some((k) => groupByKey(k)?.always))
    return { stopUrl: '', oneClickUrl: '', settingsUrl: '' }
  const base = getURL().replace(/\/$/, '')
  const token = await stopToken(profileId, groupKeys)
  return {
    stopUrl: `${base}/notifications/stop?t=${encodeURIComponent(token)}`,
    oneClickUrl: `${base}/api/notifications/stop?t=${encodeURIComponent(token)}`,
    settingsUrl: `${base}/settings/notifications`,
  }
}

// One-click unsubscribe headers (RFC 8058) for mail apps; none for always-sent kinds.
export function unsubscribeHeaders(links: EmailLinks) {
  return links.oneClickUrl
    ? [
        { Name: 'List-Unsubscribe', Value: `<${links.oneClickUrl}>` },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
      ]
    : []
}
