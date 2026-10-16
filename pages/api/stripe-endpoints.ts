import Stripe from 'stripe'
import { stripe } from '@/utils/stripe'
import { createAdminClient } from '@/db/edge'
import { TEMPLATE_IDS } from '@/utils/email'
import { notify, templateEmail } from '@/lib/notifications/notify'
import { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'node:stream'
import uuid from 'react-uuid'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/db/database.types'

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

export type StripeSession = Stripe.Event.Data.Object & {
  id: string
  metadata: {
    userId: string
    dollarQuantity: string
    passFundsToId?: string
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const buf = await buffer(req)
  let event
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      req.headers['stripe-signature'] as string,
      // Update to CLI var in dev
      process.env.STRIPE_WEBHOOKSECRET as string
    )
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    // Delayed-notification payment methods fire this event before the money
    // moves; only credit once Stripe says the session is actually paid.
    if (session.payment_status !== 'paid') {
      return res.status(200).send('ignored: not paid')
    }
    const supabase = createAdminClient()
    const txnId = uuid()
    const credited = await issueMoneys(session, txnId, supabase)
    if (!credited) {
      return res.status(200).send('already credited')
    }
    const userId = session.metadata?.userId
    const model = {
      amount: session.metadata?.dollarQuantity,
      id: txnId,
      fullName: session.customer_details?.name,
      email: session.customer_details?.email,
      destinationName: session.metadata?.passFundsToId
        ? await getProfileNameById(session.metadata?.passFundsToId, supabase)
        : 'your Manifund account',
    }
    if (userId) {
      await notify({
        to: userId,
        reason: 'deposit_receipt',
        txnId,
        amount: Number(session.metadata?.dollarQuantity ?? 0) || null,
        email: templateEmail(TEMPLATE_IDS.PAYMENT_CONFIRMATION, model, userId),
      })
    }
  }
  return res.status(200).send('success')
}

const issueMoneys = async (
  session: Stripe.Checkout.Session,
  txnId: string,
  supabase: SupabaseClient<Database>
) => {
  const { id: sessionId } = session
  const { userId, dollarQuantity, passFundsToId } = session.metadata ?? {}
  // Credit what Stripe actually collected, not what the metadata claims
  const dollarQuantityNum = (session.amount_total ?? 0) / 100
  if (dollarQuantityNum <= 0) {
    throw new Error(`checkout session ${sessionId} completed with amount_total 0`)
  }
  if (dollarQuantityNum !== Number.parseFloat(dollarQuantity)) {
    console.error(
      `checkout session ${sessionId}: metadata says $${dollarQuantity}, charged $${dollarQuantityNum}`
    )
  }
  // One transaction: the deposit, its stripe_txns record and the optional donation onward. Returns false when
  // this session was already credited (Stripe may deliver the same event more than once).
  const { data: credited } = await supabase
    .rpc('credit_stripe_checkout', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_amount: dollarQuantityNum,
      p_bank_id: process.env.NEXT_PUBLIC_PROD_BANK_ID!,
      p_txn_id: txnId,
      p_pass_funds_to: passFundsToId || undefined,
    })
    .throwOnError()
  if (!credited) console.log(`checkout session ${sessionId} already credited`)
  return credited === true
}

async function getProfileNameById(id: string, supabase: SupabaseClient) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', id)
    .single()
  return profile?.full_name ?? ''
}
