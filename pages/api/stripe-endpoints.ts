import Stripe from 'stripe'
import { stripe } from '@/utils/stripe'
import { createAdminClient } from '@/db/edge'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'node:stream'
import uuid from 'react-uuid'
import { SupabaseClient } from '@supabase/supabase-js'

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
    await issueMoneys(session, txnId, supabase)
    await sendTemplateEmail(
      TEMPLATE_IDS.PAYMENT_CONFIRMATION,
      {
        amount: session.metadata?.dollarQuantity,
        id: txnId,
        fullName: session.customer_details?.name,
        email: session.customer_details?.email,
        destinationName: session.metadata?.passFundsToId
          ? await getProfileNameById(session.metadata?.passFundsToId, supabase)
          : 'your Manifund account',
      },
      session.metadata?.userId
    )
  }
  return res.status(200).send('success')
}

const issueMoneys = async (
  session: Stripe.Checkout.Session,
  txnId: string,
  supabase: SupabaseClient
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
  // TODO: make this an RPC
  await supabase
    .from('txns')
    .insert({
      id: txnId,
      amount: dollarQuantityNum,
      from_id: process.env.NEXT_PUBLIC_PROD_BANK_ID,
      to_id: userId,
      token: 'USD',
      type: 'deposit',
    })
    .throwOnError()
  await supabase
    .from('stripe_txns')
    .insert({
      session_id: sessionId,
      customer_id: userId,
      txn_id: txnId,
      amount: dollarQuantityNum,
    })
    .throwOnError()
  if (passFundsToId) {
    await supabase.from('txns').insert({
      amount: dollarQuantityNum,
      from_id: userId,
      to_id: passFundsToId,
      token: 'USD',
      type: 'profile donation',
    })
  }
}

async function getProfileNameById(id: string, supabase: SupabaseClient) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', id)
    .single()
  return profile?.full_name ?? ''
}
