import { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'node:stream'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/db/edge'
import { WithdrawalRequest } from '@/db/withdrawal-request'
import { getTransaction } from '@/utils/mercury'
import { markSent, reverseWithdrawalRequest } from '@/utils/mercury-withdrawals'
import { sendDiscordAlert } from '@/utils/discord'

// Node runtime (no `runtime` declaration) because the signature covers the raw
// request body. Same shape as pages/api/stripe-endpoints.ts.
export const config = {
  api: {
    bodyParser: false,
  },
}
async function buffer(readable: Readable) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

const MAX_SIGNATURE_AGE_SECONDS = 300
const FAILED_TRANSACTION_STATUSES = ['failed', 'returned', 'cancelled']

// Header format is `t=<unix seconds>,v1=<hex hmac>`; the signed message is
// `<timestamp>.<raw body>`.
function verifySignature(rawBody: Buffer, header: string | undefined, secret: string) {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [key, ...rest] = piece.trim().split('=')
      return [key, rest.join('=')]
    })
  )
  const timestamp = Number(parts.t)
  const provided = parts.v1
  if (!timestamp || !provided) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_SIGNATURE_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex')
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

type MercuryEvent = {
  resourceType?: string
  resourceId?: string
  mergePatch?: { status?: string; postedAt?: string | null }
}

// Enrichment only: mercury-sync decides whether a withdrawal is sent. This
// exists for the one thing the approval poll can't see -- a wire that was
// approved and then returned by the receiving bank, which would otherwise leave
// the request looking fine forever.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.MERCURY_WEBHOOK_SECRET
  if (!secret) return res.status(503).send('Mercury webhook not configured')

  const buf = await buffer(req)
  if (!verifySignature(buf, req.headers['mercury-signature'] as string, secret)) {
    await sendDiscordAlert('🚨 Mercury webhook signature verification failed')
    return res.status(400).send('Invalid signature')
  }

  let event: MercuryEvent
  try {
    event = JSON.parse(buf.toString('utf8'))
  } catch {
    return res.status(400).send('Invalid JSON')
  }

  if (event.resourceType !== 'transaction' || !event.resourceId) {
    return res.status(200).send('success')
  }

  // Mercury delivers events for EVERY transaction on the Grants account --
  // donations in, payroll and rent out, card spend. Only a couple of statuses
  // are ours to act on, so bail before spending an API call on the rest.
  const status = event.mergePatch?.status
  if (!status || (status !== 'sent' && !FAILED_TRANSACTION_STATUSES.includes(status))) {
    return res.status(200).send('success')
  }

  const supabaseAdmin = createAdminClient()
  try {
    // The payload is a merge patch, so fetch the transaction for its own fields.
    const txn = await getTransaction(event.resourceId)
    const { request, looksLikeOurs } = await matchRequest(supabaseAdmin, txn)
    if (!request) {
      // Silence for other people's transactions; alert only when it carried one
      // of our markers and still didn't resolve, which is a real anomaly.
      if (looksLikeOurs) {
        await sendDiscordAlert(
          `⚠️ Mercury transaction ${event.resourceId} ($${txn.amount}) looks like a Manifund withdrawal but matched no request`
        )
      }
      return res.status(200).send('success')
    }

    if (FAILED_TRANSACTION_STATUSES.includes(txn.status)) {
      // Redelivery of an already-reversed failure is a no-op.
      if (request.status !== 'failed' && request.status !== 'rejected') {
        await reverseWithdrawalRequest(
          supabaseAdmin,
          request,
          'failed',
          `the bank returned the payment (${txn.status})`
        )
        await sendDiscordAlert(
          `🚨 Mercury payment returned: $${request.amount} for ${request.profile_id} (request ${request.id})`
        )
      }
    } else if (event.mergePatch?.status === 'sent') {
      const sentAt = event.mergePatch.postedAt ?? txn.postedAt ?? new Date().toISOString()
      if (request.status === 'sent') {
        // Already handled by the poll; just record the precise timestamp and id.
        await supabaseAdmin
          .from('withdrawal_requests')
          .update({ sent_at: sentAt, mercury_transaction_id: txn.id })
          .eq('id', request.id)
          .throwOnError()
      } else if (request.status === 'failed' || request.status === 'rejected') {
        // A stale 'sent' after we already reversed: flipping the row back would
        // hide the reversal, so hand it to a human instead.
        await sendDiscordAlert(
          `🚨 Mercury says transaction ${txn.id} was sent, but request ${request.id} ` +
            `was already reversed (${request.status}) — reconcile by hand.`
        )
      } else {
        await markSent(supabaseAdmin, request, sentAt, txn.id)
      }
    }
  } catch (e) {
    console.error('mercury webhook failed', event.resourceId, e)
    await sendDiscordAlert(`⚠️ Mercury webhook error on ${event.resourceId}: ${e}`)
    // Non-2xx so Mercury redelivers; a transient failure gets another chance.
    return res.status(500).send('error')
  }

  return res.status(200).send('success')
}

// Primary key is the `note` we stamp on request-send-money. Falls back to
// recipient + amount, which the one-active-request-per-profile index keeps
// unambiguous. Never guesses beyond that.
//
// `looksLikeOurs` separates "this is somebody else's transaction, ignore it"
// from "this carried a Manifund marker but didn't resolve" -- only the second
// is worth waking anyone up for.
async function matchRequest(
  supabaseAdmin: any,
  txn: { id: string; note?: string | null; amount: number; counterpartyId?: string | null }
): Promise<{ request: WithdrawalRequest | null; looksLikeOurs: boolean }> {
  const noteId = txn.note?.match(/mfw:([0-9a-f-]{36})/i)?.[1]
  if (noteId) {
    const { data } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('id', noteId)
      .maybeSingle()
      .throwOnError()
    // The marker is ours whether or not the id resolves.
    return { request: (data as WithdrawalRequest) ?? null, looksLikeOurs: true }
  }
  if (!txn.counterpartyId) return { request: null, looksLikeOurs: false }

  // No note, so this is only ours if it went to a recipient we onboarded.
  const { data: known } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('mercury_recipient_id', txn.counterpartyId)
    .maybeSingle()
    .throwOnError()
  if (!known) return { request: null, looksLikeOurs: false }

  const { data } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('*')
    .eq('mercury_recipient_id', txn.counterpartyId)
    .eq('amount', Math.abs(txn.amount))
    .in('status', ['pending_approval', 'needs_manual', 'sent'])
    .order('requested_at', { ascending: false })
    .limit(2)
    .throwOnError()
  const rows = (data ?? []) as WithdrawalRequest[]
  return { request: rows.length === 1 ? rows[0] : null, looksLikeOurs: true }
}
