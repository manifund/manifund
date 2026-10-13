// No 'server-only' marker: utils/activate-project.ts imports this and is itself imported by client
// components (app/admin/activate-project.tsx), like utils/email.ts. It only works with the
// service-role key, which the browser never has.
import { createAdminClient } from '@/db/supabase-admin'
import { log } from '@/lib/log'
import { emailModeFor, groupOf, type NotificationReason } from './groups'
import { emailLinks, loadOverrides, unsubscribeHeaders, type EmailLinks } from './settings'
import { getUserEmail, sendEmail, sendTemplateEmail } from '@/utils/email'
import { emailFooter } from './footer'

export type { EmailLinks }

// Records one in-app notification for an event that isn't a comment (N1), and sends its email
// right away if the person's setting for that group is "instant" (N2-N3); "weekly" leaves it for
// the weekly summary (N6), "off" (unsubscribed, N7) sends nothing. Never throws: the event that caused it (a donation,
// a withdrawal...) has already happened, and a failed notification is only logged (N8).
export async function notify(input: {
  to: string | null | undefined // profile id
  reason: NotificationReason
  actorId?: string | null
  projectId?: string | null
  bidId?: string | null
  txnId?: string | null
  withdrawalRequestId?: string | null
  amount?: number | null
  // Sends today's email for this event; gets the footer links to pass on (stop, settings).
  email?: (links: EmailLinks) => Promise<unknown>
}) {
  const { to, reason } = input
  if (!to) return
  try {
    const mode = emailModeFor(reason, await loadOverrides(to))
    const status = !input.email
      ? 'skipped'
      : mode === 'off'
        ? 'skipped'
        : mode === 'instant'
          ? 'sending'
          : 'digest'
    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('notifications')
      .insert({
        recipient_id: to,
        reason,
        actor_id: input.actorId ?? null,
        project_id: input.projectId ?? null,
        bid_id: input.bidId ?? null,
        txn_id: input.txnId ?? null,
        withdrawal_request_id: input.withdrawalRequestId ?? null,
        amount: input.amount ?? null,
        email_status: status,
        last_error: !input.email
          ? 'no email for this event'
          : mode === 'off'
            ? 'email off in settings'
            : null,
      })
      .select('id')
      .single()
    if (error) log.error('notifications.notify_record_failed', { reason, recipient_id: to, error })
    if (status !== 'sending' || !input.email) return
    try {
      const result = await input.email(await emailLinks(to, [groupOf(reason).key]))
      // The email helpers answer { ok: false, message } when Postmark refuses (utils/email.ts).
      if ((result as { ok?: boolean } | undefined)?.ok === false)
        throw new Error((result as { message?: string }).message ?? 'email refused')
      if (data?.id)
        await admin
          .from('notifications')
          .update({ email_status: 'sent', emailed_at: new Date().toISOString(), email_attempts: 1 })
          .eq('id', data.id)
    } catch (e) {
      log.error('notifications.notify_email_failed', {
        reason,
        notification_id: data?.id,
        error: e,
      })
      if (data?.id)
        await admin
          .from('notifications')
          .update({
            email_status: 'failed',
            email_attempts: 1,
            last_error: String(e).slice(0, 300),
          })
          .eq('id', data.id)
    }
  } catch (e) {
    log.error('notifications.notify_failed', { reason, recipient_id: to, error: e })
  }
}

// For emails sent to an address with no profile behind it yet (e.g. a grant to someone not on
// Manifund): nothing to record in-app, so the email goes out as before.
export async function notifyAddressOnly(send: () => Promise<unknown>) {
  try {
    await send()
  } catch (e) {
    log.error('notifications.address_email_failed', { error: e })
  }
}

// An email we write ourselves (no Postmark template): the body, then the footer (unsubscribe button or settings link,
// N7), with the one-click unsubscribe headers for optional kinds.
export function ownEmail(toId: string, subject: string, body: { html: string; text: string }) {
  return async (links: EmailLinks) => {
    const address = await getUserEmail(createAdminClient() as any, toId)
    if (!address) return
    const footer = emailFooter(links)
    return sendEmail(
      address,
      subject,
      body.html + footer.html,
      body.text + footer.text,
      undefined,
      undefined,
      { user_id: toId },
      unsubscribeHeaders(links)
    )
  }
}

// Today's Postmark template email, plus the footer links as template variables ({{stopUrl}},
// {{settingsUrl}}: the templates on Postmark must be edited to show them, and to show nothing when
// they're empty, as for always-sent kinds) and the one-click unsubscribe headers (optional kinds only).
export function templateEmail(templateId: number, model: object, toId: string, toEmail?: string) {
  return (links: EmailLinks) =>
    sendTemplateEmail(
      templateId,
      { ...model, ...links },
      toId,
      toEmail,
      undefined,
      undefined,
      unsubscribeHeaders(links)
    )
}
