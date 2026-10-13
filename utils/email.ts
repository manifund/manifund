import { createAdminClient } from '@/db/edge'
import { SupabaseClient } from '@supabase/supabase-js'
import { log } from '@/lib/log'

export const TEMPLATE_IDS = {
  GENERIC_NOTIF: 32825293,
  GENERIC_NOTIF_HTML: 34725473,
  VERDICT: 31974162,
  NEW_COMMENT: 31316102,
  COMMENT_WITH_MENTION: 31350706,
  CREATOR_UPDATE: 31328698,
  NEW_USER_GRANT: 31479155,
  EXISTING_USER_GRANT: 31480376,
  CASH_TO_CHARITY: 32471388,
  CONFIRM_WITHDRAWAL: 32048469,
  PAYMENT_CONFIRMATION: 31316115,
  PROJECT_DONATION: 31534853,
  REGRANTER_DONATION: 31571248,
  TRADE_ACCEPTED: 31316920,
  OFFER_RESOLVED: 31316141,
  AUCTION_RESOLVED: 31316142,
}

// For interpolating user-supplied values into hand-built htmlContent strings.
// Anything a grantee typed -- organization names, project titles, signatory
// names -- reaches these templates verbatim, and the resulting mail is sent
// from info@manifund.org to an address the same user chose, so unescaped
// interpolation would make this a ready-made phishing relay.
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// What a send returns: whether Postmark accepted it. Failures are already logged here (event `email.failed`), so
// callers may ignore the result (most do: the email is a side effect of something already saved), or check `ok` to
// log their own event or tell the person.
export type EmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; status?: number; errorCode?: number; message: string }

type PostmarkAnswer = { ErrorCode?: number; Message?: string; MessageID?: string }

const templateName = (id: number) => Object.entries(TEMPLATE_IDS).find(([, v]) => v === id)?.[0]
// The recipient's domain only: these logs live in Vercel, and addresses are personal data.
const domainOf = (to: string) =>
  to
    .split(',')
    .map((a) => a.split('@')[1]?.replace(/>.*$/, '').trim() ?? '?')
    .join(',')

// Postmark accepted the message when the call answered 2xx with ErrorCode 0.
export function postmarkResult(
  status: number,
  answer: PostmarkAnswer | null | undefined
): EmailResult {
  if (status >= 200 && status < 300 && answer?.ErrorCode === 0)
    return { ok: true, messageId: answer.MessageID }
  return {
    ok: false,
    status,
    errorCode: answer?.ErrorCode,
    message: answer?.Message ?? `HTTP ${status}`,
  }
}

async function postToPostmark(
  path: string,
  body: unknown
): Promise<{ status: number; json: unknown } | { error: string }> {
  try {
    // Using fetch instead of postmark's client because it doesn't work on the edge
    const response = await fetch(`https://api.postmarkapp.com${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN ?? '',
      },
      body: JSON.stringify(body),
    })
    return { status: response.status, json: await response.json().catch(() => null) }
  } catch (e) {
    return { error: `postmark unreachable: ${(e as Error).message}` }
  }
}

function logFailure(result: EmailResult, fields: Record<string, unknown>) {
  if (result.ok) return
  log.error('email.failed', {
    ...fields,
    status: result.status,
    error_code: result.errorCode,
    error: result.message,
  })
}

export async function sendTemplateEmail(
  templateId: number,
  templateModel: object,
  toId?: string,
  toEmail?: string,
  fromEmail?: string,
  // Ids to log with a failure (e.g. { project_id }): never addresses.
  logFields: Record<string, unknown> = {},
  // Extra headers, e.g. one-click unsubscribe (notifications N7).
  headers?: { Name: string; Value: string }[]
): Promise<EmailResult> {
  if (!toEmail && !toId) {
    console.log('No email or user id provided')
    return { ok: false, message: 'no recipient' }
  }
  const sendToEmail = toEmail ?? (await getUserEmail(createAdminClient(), toId ?? ''))

  if (!sendToEmail) {
    console.log('No email found for user', toId)
    return { ok: false, message: 'no email for user' }
  }

  const answer = await postToPostmark('/email/withTemplate', {
    From: fromEmail ?? 'info@manifund.org',
    To: sendToEmail,
    TemplateId: templateId,
    TemplateModel: templateModel,
    ...(headers?.length ? { Headers: headers } : {}),
  })
  const result =
    'error' in answer
      ? { ok: false as const, message: answer.error }
      : postmarkResult(answer.status, answer.json as PostmarkAnswer)
  logFailure(result, {
    template: templateName(templateId),
    template_id: templateId,
    to_domain: domainOf(sendToEmail),
    user_id: toId,
    ...logFields,
  })
  return result
}

export async function sendEmail(
  toEmail: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  fromEmail?: string,
  // 'outbound' for transactional emails, 'broadcast' for marketing emails
  messageStream?: string,
  // Ids to log with a failure: never addresses.
  logFields: Record<string, unknown> = {},
  // Extra headers, e.g. one-click unsubscribe (notifications N7).
  headers?: { Name: string; Value: string }[]
): Promise<EmailResult> {
  const answer = await postToPostmark('/email', {
    From: fromEmail ?? 'info@manifund.org',
    To: toEmail,
    Subject: subject,
    HtmlBody: htmlBody,
    TextBody: textBody,
    MessageStream: messageStream ?? '',
    ...(headers?.length ? { Headers: headers } : {}),
  })
  const result =
    'error' in answer
      ? { ok: false as const, message: answer.error }
      : postmarkResult(answer.status, answer.json as PostmarkAnswer)
  logFailure(result, { subject, to_domain: domainOf(toEmail), ...logFields })
  return result
}

export async function getUserEmail(supabaseAdmin: SupabaseClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.log(error)
  }
  return data ? data.email : null
}

export async function sendBatchEmail(
  emails: Array<{
    toEmail: string
    subject: string
    htmlBody: string
    textBody: string
    fromEmail?: string
    messageStream?: string
  }>
): Promise<EmailResult & { failed: number }> {
  const batchPayload = emails.map((email) => ({
    From: email.fromEmail ?? 'info@manifund.org',
    To: email.toEmail,
    Subject: email.subject,
    HtmlBody: email.htmlBody,
    TextBody: email.textBody,
    MessageStream: email.messageStream ?? 'outbound',
  }))

  const answer = await postToPostmark('/email/batch', batchPayload)
  console.log('Request size of batch payload:', JSON.stringify(batchPayload).length)
  // Postmark answers a batch with one entry per message (200 even when some are refused), or one error for all.
  if ('error' in answer || !Array.isArray(answer.json)) {
    const result =
      'error' in answer
        ? { ok: false as const, message: answer.error }
        : postmarkResult(answer.status, {
            ErrorCode: -1,
            Message: 'unexpected answer',
            ...(answer.json as PostmarkAnswer),
          })
    logFailure(result, { batch: emails.length })
    return result.ok ? { ok: true as const, failed: 0 } : { ...result, failed: emails.length }
  }
  const entries = answer.json as PostmarkAnswer[]
  let failed = 0
  entries.forEach((entry, i) => {
    const result = postmarkResult(answer.status, entry)
    if (result.ok) return
    failed++
    logFailure(result, {
      batch: emails.length,
      index: i,
      subject: emails[i]?.subject,
      to_domain: domainOf(emails[i]?.toEmail ?? ''),
    })
  })
  return failed
    ? { ok: false as const, message: `${failed} of ${emails.length} refused`, failed }
    : { ok: true as const, failed: 0 }
}
