import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { getProfileById } from '@/db/profile'
import { getFullTxnsByUser } from '@/db/txn'
import { calculateCashBalance } from '@/utils/math'
import Stripe from 'stripe'
import { stripe } from '@/utils/stripe'
import uuid from 'react-uuid'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { sendDiscordAlert } from '@/utils/discord'
import { CENTS_PER_DOLLAR } from '@/utils/constants'
import { getBidsByUser } from '@/db/bid'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
  unstable_allowDynamic: ['**/node_modules/function-bind/implementation.js'],
}

export default async function handler(req: NextRequest) {
  const { dollarAmount } = await req.json()
  const { supabase, user } = await getUserAndClient(req)
  if (!user) {
    console.error('withdraw failed: no user')
    return NextResponse.json({ error: 'You must be signed in to withdraw.' }, { status: 401 })
  }
  const profile = await getProfileById(supabase, user.id)
  if (!profile?.stripe_connect_id) {
    console.error('withdraw failed: no stripe connect id', user.id)
    return NextResponse.json(
      { error: 'Set up your Stripe account before withdrawing.' },
      { status: 400 }
    )
  }
  const account = await stripe.accounts.retrieve(profile.stripe_connect_id)
  if (!account.payouts_enabled || !account.details_submitted) {
    console.error('withdraw failed: payouts not enabled', user.id)
    return NextResponse.json(
      { error: 'Complete your Stripe onboarding before withdrawing.' },
      { status: 400 }
    )
  }
  const txns = await getFullTxnsByUser(supabase, user.id)
  const bids = await getBidsByUser(supabase, user.id)
  const withdrawBalance = calculateCashBalance(txns, bids, user.id, profile.accreditation_status)
  if (dollarAmount <= 0 || dollarAmount > withdrawBalance) {
    console.error('withdraw failed: invalid amount', user.id, dollarAmount)
    return NextResponse.json(
      { error: 'Withdrawal amount exceeds your withdrawable balance.' },
      { status: 400 }
    )
  }

  // Insert the withdrawal txn BEFORE the Stripe transfer to prevent double-withdrawal.
  // If a concurrent request also inserts, the re-check below will catch it.
  const txnId = uuid()
  const supabaseAdmin = createAdminClient()
  await supabaseAdmin
    .from('txns')
    .insert({
      id: txnId,
      from_id: user.id,
      to_id: process.env.NEXT_PUBLIC_PROD_BANK_ID ?? '',
      amount: dollarAmount,
      token: 'USD',
      project: null,
      type: 'withdraw',
    })
    .throwOnError()

  // Re-check balance after insert to detect concurrent withdrawals
  const txnsAfter = await getFullTxnsByUser(supabase, user.id)
  const bidsAfter = await getBidsByUser(supabase, user.id)
  const balanceAfter = calculateCashBalance(
    txnsAfter,
    bidsAfter,
    user.id,
    profile.accreditation_status
  )
  if (balanceAfter < 0) {
    // Concurrent withdrawal detected — roll back our txn
    await supabaseAdmin.from('txns').delete().eq('id', txnId).throwOnError()
    console.error('withdraw failed: concurrent withdrawal, rolled back', user.id, dollarAmount)
    return NextResponse.json(
      { error: 'Another withdrawal is already in progress. Please try again.' },
      { status: 409 }
    )
  }

  let transfer
  try {
    transfer = await stripe.transfers.create({
      amount: dollarAmount * CENTS_PER_DOLLAR,
      currency: 'usd',
      destination: profile.stripe_connect_id,
    })
  } catch (e) {
    console.error('withdraw failed: stripe transfer failed', user.id, dollarAmount, e)
    // Stripe transfer failed — roll back the txn
    let rollbackFailed = false
    try {
      await supabaseAdmin.from('txns').delete().eq('id', txnId).throwOnError()
    } catch (rollbackError) {
      rollbackFailed = true
      console.error('withdraw rollback failed', user.id, txnId, rollbackError)
    }
    const stripeErrorCode = e instanceof Stripe.errors.StripeError ? e.code : 'unknown'
    await sendDiscordAlert(
      `🚨 Withdrawal failed for ${profile.full_name} (${user.email}): ` +
        `$${dollarAmount}, Stripe error: ${stripeErrorCode}, user id: ${user.id}` +
        (rollbackFailed
          ? `\n⚠️ Rollback of txn ${txnId} also failed — their balance is now wrong!`
          : '')
    )
    return NextResponse.json(
      { error: 'Withdrawal failed. Our team has been notified and will follow up.' },
      { status: 500 }
    )
  }

  await supabaseAdmin
    .from('stripe_txns')
    .insert({
      session_id: transfer.id,
      customer_id: user.id,
      amount: dollarAmount,
      txn_id: txnId,
    })
    .throwOnError()
  const usedBank = account.external_accounts?.data[0].object === 'bank_account'
  const last4 = account.external_accounts?.data[0].last4
  const postmarkVars = {
    amount: dollarAmount,
    id: txnId,
    methodText: (usedBank ? 'Account number ending in: ' : 'Card ending in: ') + last4,
    fullName: profile.full_name,
    email: user.email,
  }
  await sendTemplateEmail(TEMPLATE_IDS.CONFIRM_WITHDRAWAL, postmarkVars, undefined, user.email)
  return NextResponse.json({ dollarAmount })
}
