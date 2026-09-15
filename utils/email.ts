import { createAdminClient } from '@/db/edge'
import { SupabaseClient } from '@supabase/supabase-js'

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

export async function sendTemplateEmail(
  templateId: number,
  templateModel: object,
  toId?: string,
  toEmail?: string,
  fromEmail?: string
) {
  const supabase = createAdminClient()
  if (!toEmail && !toId) {
    console.log('No email or user id provided')
    return
  }
  const sendToEmail = toEmail ?? (await getUserEmail(supabase, toId ?? ''))

  if (!sendToEmail) {
    console.log('No email found for user', toId)
    return
  }

  // Using fetch instead of postmark's client because it doesn't work on the edge:
  const response = await fetch('https://api.postmarkapp.com/email/withTemplate', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN ?? '',
    },
    body: JSON.stringify({
      From: fromEmail ?? 'info@manifund.org',
      To: sendToEmail,
      TemplateId: templateId,
      TemplateModel: templateModel,
    }),
  })
  const json = await response.json()
  console.log('Sent message', json)
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
) {
  const batchPayload = emails.map((email) => ({
    From: email.fromEmail ?? 'info@manifund.org',
    To: email.toEmail,
    Subject: email.subject,
    HtmlBody: email.htmlBody,
    TextBody: email.textBody,
    MessageStream: email.messageStream ?? 'outbound',
  }))

  const response = await fetch('https://api.postmarkapp.com/email/batch', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN ?? '',
    },
    body: JSON.stringify(batchPayload),
  })

  const json = await response.json()
  console.log('Sent batch emails', json)
  console.log('Request size of batch payload:', JSON.stringify(batchPayload).length)
  return json
}
