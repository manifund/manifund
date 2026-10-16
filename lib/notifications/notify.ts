// No 'server-only' marker: utils/activate-project.ts imports this and is itself imported by client
// components (app/admin/activate-project.tsx), like utils/email.ts. It only works with the
// service-role key, which the browser never has.
import { createAdminClient } from '@/db/supabase-admin'
import { log } from '@/lib/log'
import { emailModeFor, isEssential, type NotificationReason } from './kinds'
import { emailLinks, loadEmailChoices, unsubscribeHeaders, type EmailLinks } from './settings'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { notificationModel, type NotificationContent } from './notification-email'

export type { EmailLinks }

type NotifyInput = {
  to: string | null | undefined // profile id
  reason: NotificationReason
  actorId?: string | null
  projectId?: string | null
  bidId?: string | null
  txnId?: string | null
  withdrawalRequestId?: string | null
  savedSearchId?: string | null
  amount?: number | null
  // Sends today's email for this event; gets the footer links to pass on (stop, settings).
  email?: (links: EmailLinks) => Promise<unknown>
}

// Records one in-app notification for an event that isn't a comment (N1), and sends its email right away when
// the reason is essential or the person's choice is "immediate" (N3, N4); "daily" leaves it for the daily summary
// (N5), "never" sends nothing. Never throws: the event that caused it (a donation,
// a withdrawal...) has already happened, and a failed notification is only logged (N7).
export async function notify(input: NotifyInput) {
  await notifyMany([input])
}

// The same for many people at once (e.g. everyone who follows a donor, F4): one query for their email choices, one
// insert for all the rows, and the right-away emails sent in parallel. One notification per person: a repeated
// recipient keeps the first.
export async function notifyMany(inputs: NotifyInput[]) {
  const seen = new Set<string>()
  const list = inputs.filter((i): i is NotifyInput & { to: string } => {
    if (!i.to || seen.has(i.to)) return false
    seen.add(i.to)
    return true
  })
  if (!list.length) return
  try {
    const optional = list.filter((i) => !isEssential(i.reason)).map((i) => i.to)
    const choices = await loadEmailChoices(optional)
    const planned = list.map((input) => {
      const mode = emailModeFor(input.reason, choices.get(input.to))
      const status = !input.email
        ? 'skipped'
        : mode === 'never'
          ? 'skipped'
          : mode === 'immediate'
            ? 'sending'
            : 'digest'
      return { input, status }
    })
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('notifications')
      .insert(
        planned.map(({ input, status }) => ({
          recipient_id: input.to,
          reason: input.reason,
          actor_id: input.actorId ?? null,
          project_id: input.projectId ?? null,
          bid_id: input.bidId ?? null,
          txn_id: input.txnId ?? null,
          withdrawal_request_id: input.withdrawalRequestId ?? null,
          saved_search_id: input.savedSearchId ?? null,
          amount: input.amount ?? null,
          email_status: status,
          last_error: !input.email
            ? 'no email for this event'
            : status === 'skipped'
              ? 'email set to never'
              : null,
        }))
      )
      .select('id, recipient_id')
    if (error)
      log.error('notifications.notify_record_failed', {
        reason: list[0].reason,
        count: list.length,
        error,
      })
    const idOf = new Map(
      ((data ?? []) as { id: string; recipient_id: string }[]).map((r) => [r.recipient_id, r.id])
    )
    const sending = planned.filter((p) => p.status === 'sending' && p.input.email)
    const results = await Promise.all(
      sending.map(async ({ input }) => {
        const id = idOf.get(input.to)
        try {
          const result = await input.email!(await emailLinks(input.to, isEssential(input.reason)))
          // The email helpers answer { ok: false, message } when Postmark refuses (utils/email.ts).
          if ((result as { ok?: boolean } | undefined)?.ok === false)
            throw new Error((result as { message?: string }).message ?? 'email refused')
          return { id, ok: true as const }
        } catch (e) {
          log.error('notifications.notify_email_failed', {
            reason: input.reason,
            notification_id: id,
            error: e,
          })
          return { id, ok: false as const, error: String(e).slice(0, 300) }
        }
      })
    )
    const sent = results.flatMap((r) => (r.ok && r.id ? [r.id] : []))
    if (sent.length)
      await admin
        .from('notifications')
        .update({ email_status: 'sent', emailed_at: new Date().toISOString(), email_attempts: 1 })
        .in('id', sent)
    for (const r of results)
      if (!r.ok && r.id)
        await admin
          .from('notifications')
          .update({ email_status: 'failed', email_attempts: 1, last_error: r.error })
          .eq('id', r.id)
  } catch (e) {
    log.error('notifications.notify_failed', {
      reason: list[0].reason,
      recipient_id: list.length === 1 ? list[0].to : undefined,
      count: list.length,
      error: e,
    })
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

// Emails about people you follow and saved searches: the "notification" Postmark template, with the content
// built in code (notification-email.ts).
export function notificationEmail(toId: string, content: NotificationContent) {
  return templateEmail(TEMPLATE_IDS.NOTIFICATION, notificationModel(content), toId)
}

// A Postmark template email, plus the footer links as template variables (optional kinds only, N6): {{stopUrl}} and
// {{settingsUrl}}, and the same inside {{#footer}} for templates that show the footer only when it's there (the
// "notification" template). Older templates show them only once edited on Postmark. Also the one-click unsubscribe
// headers.
export function templateEmail(templateId: number, model: object, toId: string, toEmail?: string) {
  return (links: EmailLinks) =>
    sendTemplateEmail(
      templateId,
      {
        ...model,
        ...links,
        footer: links.stopUrl ? { stopUrl: links.stopUrl, settingsUrl: links.settingsUrl } : null,
      },
      toId,
      toEmail,
      undefined,
      undefined,
      unsubscribeHeaders(links)
    )
}
