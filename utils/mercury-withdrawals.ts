// State machine shared by the Mercury withdrawal routes: the request endpoint,
// the hourly sync cron, the nudge cron, and the webhook. Side effects (email,
// Discord) live here so no two routes can disagree about what a transition means.

import { SupabaseClient } from '@supabase/supabase-js'
import { WithdrawalRequest } from '@/db/withdrawal-request'
import { getUserEmail, sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { sendDiscordAlert } from '@/utils/discord'
import {
  getRecipient,
  getRecipientInvite,
  isManualWireCountry,
  listSendMoneyRequests,
  listSentTransactionsSince,
  PaymentMethod,
  requestSendMoney,
} from '@/utils/mercury'

const REQUEST_URL = 'https://manifund.org/withdraw/request'

function methodLabel(paymentMethod: string) {
  return paymentMethod === 'internationalWire' ? 'International wire' : 'Bank transfer (ACH)'
}

async function patch(admin: SupabaseClient, id: string, fields: Record<string, unknown>) {
  await admin
    .from('withdrawal_requests')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .throwOnError()
}

// Everyone's bank details are collected by Mercury the same way. The only fork
// is at payment time: an India or Philippines wire needs a purpose code the API
// can't send, so it goes to an admin instead of the approval queue. The
// recipient already exists in Mercury by this point, so they just pick it in the
// dashboard rather than re-keying account numbers.
export async function routePayment(admin: SupabaseClient, request: WithdrawalRequest) {
  const recipientId = request.mercury_recipient_id
  if (!recipientId) throw new Error(`No recipient on withdrawal request ${request.id}`)

  const recipient = await getRecipient(recipientId)
  if (!isManualWireCountry(recipient)) {
    return await submitSendMoney(admin, request)
  }

  await patch(admin, request.id, { status: 'needs_manual' })
  await sendDiscordAlert(
    `📝 Manual wire needed: $${request.amount} to ${recipient.name}. ` +
      `India and the Philippines need a purpose code Mercury's API can't send. ` +
      `Their bank details are already in Mercury under recipient ${recipientId} — ` +
      `just send it from the dashboard.`
  )
  return null
}

// Queue the payment for approval in Mercury. Reuses the stored idempotency key
// so a retry after a timeout can't double-pay.
export async function submitSendMoney(admin: SupabaseClient, request: WithdrawalRequest) {
  const recipientId = request.mercury_recipient_id
  if (!recipientId) throw new Error(`No recipient on withdrawal request ${request.id}`)
  const sent = await requestSendMoney({
    recipientId,
    amount: Number(request.amount),
    paymentMethod: request.payment_method as PaymentMethod,
    idempotencyKey: request.idempotency_key,
    withdrawalRequestId: request.id,
  })
  await patch(admin, request.id, {
    status: 'pending_approval',
    mercury_request_id: sent.requestId,
    submitted_at: new Date().toISOString(),
  })
  return sent
}

// Undo a withdrawal that will never be paid: delete the reserving txn so the
// money reappears in the grantee's balance, then tell them.
//
// A DELETE rather than a compensating deposit -- a 'deposit' row from the bank
// account is indistinguishable from a real donation and would corrupt receipts,
// the admin transactions view, and tools/recon.
export async function reverseWithdrawalRequest(
  admin: SupabaseClient,
  request: WithdrawalRequest,
  status: 'failed' | 'rejected',
  reason: string
) {
  if (request.txn_id) {
    await admin.from('txns').delete().eq('id', request.txn_id).throwOnError()
  }
  await patch(admin, request.id, { status, failure_reason: reason })

  const email = await getUserEmail(admin, request.profile_id)
  if (email) {
    await sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        notifText:
          `Your withdrawal of $${Number(request.amount).toLocaleString()} didn't go through (${reason}). ` +
          `The money is back in your Manifund account and you can request it again whenever you like.`,
        buttonUrl: REQUEST_URL,
        buttonText: 'Try again',
        subject: 'Manifund: your withdrawal was not completed',
      },
      undefined,
      email
    )
  }
  await sendDiscordAlert(
    `⚠️ Withdrawal reversed for ${request.profile_id}: $${request.amount}, ${reason} (request ${request.id})`
  )
}

export async function markSent(
  admin: SupabaseClient,
  request: WithdrawalRequest,
  sentAt: string,
  transactionId?: string
) {
  await patch(admin, request.id, {
    status: 'sent',
    sent_at: sentAt,
    ...(transactionId ? { mercury_transaction_id: transactionId } : {}),
  })
  const email = await getUserEmail(admin, request.profile_id)
  if (email) {
    await sendTemplateEmail(
      TEMPLATE_IDS.CONFIRM_WITHDRAWAL,
      {
        amount: Number(request.amount),
        id: request.id,
        methodText: methodLabel(request.payment_method),
        fullName: '',
        email,
      },
      undefined,
      email
    )
  }
}

// One open request, advanced as far as it can go. Safe to call repeatedly.
export async function syncWithdrawalRequest(admin: SupabaseClient, request: WithdrawalRequest) {
  if (request.status === 'awaiting_recipient') {
    if (!request.mercury_invite_id) return
    const invite = await getRecipientInvite(request.mercury_invite_id)
    if (invite.status === 'expired') {
      await reverseWithdrawalRequest(admin, request, 'failed', 'bank details were never submitted')
      return
    }
    if (invite.status !== 'completed' || !invite.recipientId) return

    // Cache on the profile too, so their next withdrawal skips onboarding.
    await admin
      .from('profiles')
      .update({ mercury_recipient_id: invite.recipientId })
      .eq('id', request.profile_id)
      .throwOnError()
    await patch(admin, request.id, {
      status: 'ready_to_pay',
      mercury_recipient_id: invite.recipientId,
    })
    await routePayment(admin, { ...request, mercury_recipient_id: invite.recipientId })
    return
  }

  if (request.status === 'ready_to_pay') {
    await routePayment(admin, request)
    return
  }

  // A manual wire produces an ordinary Mercury transaction, so watch for one to
  // the recipient we set up rather than making an admin tell us it happened.
  if (request.status === 'needs_manual') {
    if (!request.mercury_recipient_id) return
    const sent = await listSentTransactionsSince(request.requested_at)
    // amount < 0 keeps money *coming in* from the same counterparty from being
    // mistaken for the wire going out. If Mercury turns out not to sign outgoing
    // transactions negatively, nothing auto-matches and the stuck alert in
    // mercury-sync eventually points at a SQL fix -- the right way to fail.
    const matches = sent.filter(
      (t) =>
        t.counterpartyId === request.mercury_recipient_id &&
        t.amount < 0 &&
        Math.abs(t.amount) === Number(request.amount) &&
        (t.createdAt ?? t.postedAt ?? '') >= request.requested_at
    )
    // Two payments of the same amount to the same recipient is ambiguous; say so
    // rather than closing out the wrong one.
    if (matches.length > 1) {
      await sendDiscordAlert(
        `⚠️ Withdrawal ${request.id} matches ${matches.length} sent Mercury transactions — ` +
          `set status='sent' and sent_at on the right one in SQL and email the grantee.`
      )
      return
    }
    const match = matches[0]
    if (match) {
      await markSent(admin, request, match.postedAt ?? new Date().toISOString(), match.id)
    }
    return
  }

  if (request.status === 'pending_approval') {
    if (!request.mercury_request_id) return
    const all = await listSendMoneyRequests()
    const match = all.find((r) => r.requestId === request.mercury_request_id)
    if (!match) return
    if (match.status === 'approved') {
      await markSent(admin, request, new Date().toISOString())
    } else if (match.status === 'rejected' || match.status === 'cancelled') {
      await reverseWithdrawalRequest(
        admin,
        request,
        'rejected',
        `payment ${match.status} in Mercury`
      )
    }
  }
}
