// No 'server-only' marker: utils/activate-project.ts imports this and is itself imported by client
// components (app/admin/activate-project.tsx), like utils/email.ts. It only works with the
// service-role key, which the browser never has.
import { createAdminClient } from '@/db/supabase-admin'
import { getURL } from '@/utils/constants'
import { log } from '@/lib/log'
import { DEFAULT_EMAIL_CHOICE, type EmailChoice } from './kinds'

// People's stored email choices (N4), raw: kinds.ts's emailChoice turns a missing one into the default.
export async function loadEmailChoices(profileIds: string[]): Promise<Map<string, string>> {
  if (!profileIds.length) return new Map()
  const { data, error } = await createAdminClient()
    .from('notification_email')
    .select('profile_id, choice')
    .in('profile_id', profileIds)
  if (error) log.error('notifications.email_choice_load_failed', { error })
  return new Map((data ?? []).map((r: any) => [r.profile_id as string, r.choice as string]))
}

export async function loadEmailChoice(profileId: string) {
  return (await loadEmailChoices([profileId])).get(profileId) ?? null
}

// The only writer of notification_email (server-only, N4): the choice on /notifications, and an email's
// unsubscribe button ('never'). Choosing the default removes the row.
export async function setEmailChoice(profileId: string, choice: EmailChoice) {
  const table = createAdminClient().from('notification_email')
  const { error } =
    choice === DEFAULT_EMAIL_CHOICE
      ? await table.delete().eq('profile_id', profileId)
      : await table.upsert({ profile_id: profileId, choice, updated_at: new Date().toISOString() })
  if (error) {
    log.error('notifications.email_choice_save_failed', { profile_id: profileId, error })
    return { error: 'could not save' }
  }
  log.info('notifications.email_choice_saved', { profile_id: profileId, choice })
  return { error: null }
}

// Signed unsubscribe links (N6): the profile, HMAC-signed with a key derived from the service-role key, so no new
// secret is needed. No expiry: an old email's link keeps working.
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

export async function stopToken(profileId: string) {
  return `${profileId}.${await hmac(profileId)}`
}

export async function readStopToken(token: string) {
  const [profileId, sig, extra] = token.split('.')
  if (!profileId || !sig || extra !== undefined) return null
  if ((await hmac(profileId)) !== sig) return null
  return { profileId }
}

// Footer links of optional emails (N6): "Unsubscribe" (sets the choice to never) and "Change how often" (the choice
// on /notifications). Essential emails carry none of it: empty links, no headers.
export type EmailLinks = { stopUrl: string; oneClickUrl: string; settingsUrl: string }

export async function emailLinks(profileId: string, essential: boolean): Promise<EmailLinks> {
  if (essential) return { stopUrl: '', oneClickUrl: '', settingsUrl: '' }
  const base = getURL().replace(/\/$/, '')
  const token = encodeURIComponent(await stopToken(profileId))
  return {
    stopUrl: `${base}/notifications/stop?t=${token}`,
    oneClickUrl: `${base}/api/notifications/stop?t=${token}`,
    settingsUrl: `${base}/notifications`,
  }
}

// The footer links as Postmark template variables: {{stopUrl}} and {{settingsUrl}}, and the same inside {{#footer}},
// which templates use to show the footer on optional emails only (null for essential ones, N6).
export function footerVars(links: EmailLinks) {
  return {
    ...links,
    footer: links.stopUrl ? { stopUrl: links.stopUrl, settingsUrl: links.settingsUrl } : null,
  }
}

// One-click unsubscribe headers (RFC 8058) for mail apps; none for essential emails.
export function unsubscribeHeaders(links: EmailLinks) {
  return links.oneClickUrl
    ? [
        { Name: 'List-Unsubscribe', Value: `<${links.oneClickUrl}>` },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
      ]
    : []
}
