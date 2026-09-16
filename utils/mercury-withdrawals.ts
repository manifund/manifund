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
  MercuryApiError,
  PaymentMethod,
  requestSendMoney,
  SendMoneyRequest,
} from '@/utils/mercury'

const REQUEST_URL = 'https://manifund.org/withdraw/request'

function methodLabel(paymentMethod: string) {
  return paymentMethod === 'internationalWire' ? 'International wire' : 'Bank transfer (ACH)'
}

// Best-effort: a mail hiccup must not fail (or re-run) the money movement.
async function sendQueuedEmail(admin: SupabaseClient, request: WithdrawalRequest) {
  try {
    const email = await getUserEmail(admin, request.profile_id)
    if (!email) return
    await sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        notifText:
          `Your withdrawal of $${Number(request.amount).toLocaleString()} is queued and waiting on ` +
          `approval from the Manifund team. We'll email you as soon as the money is on its way.`,
        buttonUrl: REQUEST_URL,
        buttonText: 'View status',
        subject: 'Manifund: your withdrawal is queued',
      },
      undefined,
      email
    )
  } catch (e) {
    console.error('queued email failed for', request.id, e)
  }
}

// Guarded transition: the withdrawal page fires a sync on mount and on every
// window focus, so two syncs (or a sync and the webhook) can act on one row at
// the same time. Only the caller that actually moves the row runs the
// transition's side effects; a loser sees zero rows updated and stands down.
async function claim(
  admin: SupabaseClient,
  id: string,
  fromStatus: string,
  fields: Record<string, unknown>
) {
  const { data } = await admin
    .from('withdrawal_requests')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', fromStatus)
    .select('id')
    .throwOnError()
  return (data ?? []).length > 0
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

  if (!(await claim(admin, request.id, 'ready_to_pay', { status: 'needs_manual' }))) return null
  await sendDiscordAlert(
    `📝 Manual wire needed: $${request.amount} to ${recipient.name}. ` +
      `India and the Philippines need a purpose code Mercury's API can't send. ` +
      `Their bank details are already in Mercury under recipient ${recipientId} — ` +
      `just send it from the dashboard.`
  )
  await sendQueuedEmail(admin, request)
  return null
}

// Queue the payment for approval in Mercury. Reuses the stored idempotency key
// so a retry after a timeout can't double-pay.
export async function submitSendMoney(admin: SupabaseClient, request: WithdrawalRequest) {
  const recipientId = request.mercury_recipient_id
  if (!recipientId) throw new Error(`No recipient on withdrawal request ${request.id}`)
  let sent: SendMoneyRequest
  try {
    sent = await requestSendMoney({
      recipientId,
      amount: Number(request.amount),
      paymentMethod: request.payment_method as PaymentMethod,
      idempotencyKey: request.idempotency_key,
      withdrawalRequestId: request.id,
    })
  } catch (e) {
    // Mercury 400s on idempotency-key reuse instead of replaying the original
    // response, so reuse means the payment is already queued -- by a concurrent
    // sync, or a run that died before recording it. Recover the existing
    // request rather than failing.
    if (!(e instanceof MercuryApiError && e.status === 400 && e.message.includes('idempotency'))) {
      throw e
    }
    const matches = (await listSendMoneyRequests()).filter(
      (r) => r.recipientId === recipientId && r.amount === Number(request.amount)
    )
    if (matches.length !== 1) {
      await sendDiscordAlert(
        `⚠️ Withdrawal ${request.id} was already submitted to Mercury but matches ` +
          `${matches.length} send-money requests — set mercury_request_id and ` +
          `status='pending_approval' on it in SQL.`
      )
      return null
    }
    sent = matches[0]
  }
  const claimed = await claim(admin, request.id, 'ready_to_pay', {
    status: 'pending_approval',
    mercury_request_id: sent.requestId,
    submitted_at: new Date().toISOString(),
  })
  if (claimed) await sendQueuedEmail(admin, request)
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
  // Claim before deleting the txn: if another caller just marked the row sent
  // (or reversed it first), un-reserving the balance here would corrupt it.
  if (!(await claim(admin, request.id, request.status, { status, failure_reason: reason }))) return
  if (request.txn_id) {
    try {
      await admin.from('txns').delete().eq('id', request.txn_id).throwOnError()
    } catch (e) {
      // The row is already marked reversed, so nothing will retry this delete:
      // without it the balance stays reserved forever. Flag it for a human.
      await sendDiscordAlert(
        `🚨 Withdrawal ${request.id} marked ${status} but deleting reserving txn ` +
          `${request.txn_id} failed — delete it in SQL or the balance stays wrong.`
      )
      throw e
    }
  }

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
  const claimed = await claim(admin, request.id, request.status, {
    status: 'sent',
    sent_at: sentAt,
    ...(transactionId ? { mercury_transaction_id: transactionId } : {}),
  })
  if (!claimed) {
    // A concurrent caller beat us to 'sent' and already emailed; just fill in
    // the transaction details if we have better ones.
    if (transactionId) {
      await admin
        .from('withdrawal_requests')
        .update({ sent_at: sentAt, mercury_transaction_id: transactionId })
        .eq('id', request.id)
        .eq('status', 'sent')
        .throwOnError()
    }
    return
  }
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
    const claimed = await claim(admin, request.id, 'awaiting_recipient', {
      status: 'ready_to_pay',
      mercury_recipient_id: invite.recipientId,
    })
    if (!claimed) return
    await routePayment(admin, {
      ...request,
      status: 'ready_to_pay',
      mercury_recipient_id: invite.recipientId,
    })
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
