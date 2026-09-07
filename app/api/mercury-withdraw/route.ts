import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/db/supabase-admin'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import { getFullTxnsByUser } from '@/db/txn'
import { getBidsByUser } from '@/db/bid'
import { calculateCashBalance } from '@/utils/math'
import { isProd } from '@/db/env'
import uuid from 'react-uuid'
import { sendDiscordAlert } from '@/utils/discord'
import { createRecipientInvite, hasMercuryKeys, PaymentMethod } from '@/utils/mercury'
import { routePayment } from '@/utils/mercury-withdrawals'
import { getKnownPaymentMethod, OPEN_STATUSES } from '@/db/withdrawal-request'
import {
  MERCURY_ENABLED,
  MERCURY_REQUIRE_TAX_DOCUMENT,
  mercuryMinWithdrawal,
} from '@/utils/constants'

export type MercuryWithdrawProps = {
  dollarAmount: number
  destination: 'us' | 'international'
  feedback?: string
}

export async function POST(req: NextRequest) {
  // There is no Mercury sandbox and dev shares the production token, so a dev
  // server must never be able to move money.
  if (!isProd()) {
    return NextResponse.json(
      { error: 'Withdrawals are only available in production.' },
      { status: 403 }
    )
  }
  if (!MERCURY_ENABLED || !hasMercuryKeys()) {
    return NextResponse.json({ error: 'Bank withdrawals are not enabled yet.' }, { status: 503 })
  }

  const body = (await req.json()) as MercuryWithdrawProps
  const { destination, feedback } = body
  // Balances are float sums and can carry sub-cent dust Mercury would reject.
  const dollarAmount = Number.isFinite(body.dollarAmount)
    ? Math.round(body.dollarAmount * 100) / 100
    : NaN
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user?.email) {
    return NextResponse.json({ error: 'You must be signed in to withdraw.' }, { status: 401 })
  }
  const profile = await getProfileById(supabase, user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 400 })
  }

  const txns = await getFullTxnsByUser(supabase, user.id)
  const bids = await getBidsByUser(supabase, user.id)
  const withdrawBalance = calculateCashBalance(txns, bids, user.id, profile.accreditation_status)
  const minWithdrawal = mercuryMinWithdrawal(withdrawBalance)
  if (withdrawBalance <= 0) {
    return NextResponse.json({ error: 'You have no funds to withdraw.' }, { status: 400 })
  }
  if (dollarAmount > withdrawBalance) {
    return NextResponse.json(
      { error: `Withdrawal amount exceeds your withdrawable balance of $${withdrawBalance}.` },
      { status: 400 }
    )
  }
  if (!Number.isFinite(dollarAmount) || dollarAmount < minWithdrawal) {
    return NextResponse.json(
      { error: `Minimum Mercury withdrawal is $${minWithdrawal.toLocaleString()}.` },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient()
  const { data: existing } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('id')
    .eq('profile_id', user.id)
    .in('status', OPEN_STATUSES as unknown as string[])
    .maybeSingle()
    .throwOnError()
  if (existing) {
    return NextResponse.json(
      {
        error:
          'You already have a withdrawal in progress. It has to finish before you start another.',
      },
      { status: 409 }
    )
  }

  // A returning grantee's recipient only holds routing details for the one
  // method it was onboarded with, so use that rather than whatever the client
  // sent -- an ACH send to an international-only recipient would just fail.
  const knownPaymentMethod = profile.mercury_recipient_id
    ? await getKnownPaymentMethod(supabaseAdmin, user.id, profile.mercury_recipient_id)
    : null
  const paymentMethod: PaymentMethod =
    knownPaymentMethod ?? (destination === 'us' ? 'ach' : 'internationalWire')

  // Insert the withdrawal txn BEFORE calling Mercury, so the balance is
  // reserved for the days this request may sit awaiting details or approval.
  // Without it, the same funds could also be drained via Stripe Connect.
  const txnId = uuid()
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

  // Re-check after insert to catch a concurrent withdrawal.
  const txnsAfter = await getFullTxnsByUser(supabase, user.id)
  const bidsAfter = await getBidsByUser(supabase, user.id)
  const balanceAfter = calculateCashBalance(
    txnsAfter,
    bidsAfter,
    user.id,
    profile.accreditation_status
  )
  if (balanceAfter < 0) {
    await supabaseAdmin.from('txns').delete().eq('id', txnId).throwOnError()
    return NextResponse.json(
      { error: 'Another withdrawal is already in progress. Please try again.' },
      { status: 409 }
    )
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from('withdrawal_requests')
    .insert({
      profile_id: user.id,
      amount: dollarAmount,
      payment_method: paymentMethod,
      status: 'awaiting_recipient',
      txn_id: txnId,
      feedback: feedback || null,
    })
    .select()
    .single()
  if (requestError || !request) {
    // A concurrent submit lands here via the one-open-request unique index.
    // Either way the reserving txn must not outlive the failed insert.
    console.error('mercury withdraw: request insert failed', requestError)
    let rollbackFailed = false
    try {
      await supabaseAdmin.from('txns').delete().eq('id', txnId).throwOnError()
    } catch (e) {
      rollbackFailed = true
      console.error('mercury withdraw rollback failed', user.id, txnId, e)
    }
    const duplicate = requestError?.code === '23505'
    if (!duplicate || rollbackFailed) {
      await sendDiscordAlert(
        `🚨 Mercury withdrawal insert failed for ${profile.full_name} (${user.email}): ` +
          `$${dollarAmount}, ${requestError?.message}` +
          (rollbackFailed
            ? `\n⚠️ Rollback of txn ${txnId} also failed — their balance is now wrong!`
            : '')
      )
    }
    return NextResponse.json(
      {
        error: duplicate
          ? 'You already have a withdrawal in progress. It has to finish before you start another.'
          : 'Withdrawal failed. Our team has been notified and will follow up.',
      },
      { status: duplicate ? 409 : 500 }
    )
  }

  const rollback = async (context: string, e: unknown) => {
    console.error('mercury withdraw failed:', context, e)
    let rollbackFailed = false
    try {
      await supabaseAdmin.from('withdrawal_requests').delete().eq('id', request.id).throwOnError()
      await supabaseAdmin.from('txns').delete().eq('id', txnId).throwOnError()
    } catch (rollbackError) {
      rollbackFailed = true
      console.error('mercury withdraw rollback failed', user.id, txnId, rollbackError)
    }
    await sendDiscordAlert(
      `🚨 Mercury withdrawal failed for ${profile.full_name} (${user.email}): ` +
        `$${dollarAmount}, ${context}, user id: ${user.id}` +
        (rollbackFailed
          ? `\n⚠️ Rollback of txn ${txnId} also failed — their balance is now wrong!`
          : '')
    )
  }

  // A returning grantee already has a recipient on file, so skip onboarding
  // entirely and queue the payment for approval right away.
  if (profile.mercury_recipient_id) {
    try {
      await supabaseAdmin
        .from('withdrawal_requests')
        .update({ mercury_recipient_id: profile.mercury_recipient_id, status: 'ready_to_pay' })
        .eq('id', request.id)
        .throwOnError()
    } catch (e) {
      await rollback('marking ready_to_pay failed', e)
      return NextResponse.json(
        { error: 'Withdrawal failed. Our team has been notified and will follow up.' },
        { status: 500 }
      )
    }
    try {
      const sent = await routePayment(supabaseAdmin, {
        ...request,
        mercury_recipient_id: profile.mercury_recipient_id,
      })
      return NextResponse.json({ status: sent ? 'pending_approval' : 'needs_manual' })
    } catch (e) {
      // Mercury may already have the payment queued (timeout, or a failed
      // status patch after an accepted send), so never roll back here: the row
      // holds the idempotency key and the hourly sync retries ready_to_pay rows.
      console.error('mercury withdraw: routePayment failed', request.id, e)
      await sendDiscordAlert(
        `⚠️ Mercury payment submission failed for ${profile.full_name} (${user.email}): ` +
          `$${dollarAmount}, request ${request.id}. Left as ready_to_pay; the hourly ` +
          `sync will retry it with the same idempotency key.`
      )
      return NextResponse.json({ status: 'ready_to_pay' })
    }
  }

  try {
    const invite = await createRecipientInvite({
      name: profile.full_name,
      contactEmail: user.email,
      paymentMethod,
      requireTaxDocument: MERCURY_REQUIRE_TAX_DOCUMENT,
    })
    await supabaseAdmin
      .from('withdrawal_requests')
      .update({
        mercury_invite_id: invite.id,
        mercury_onboarding_url: invite.onboardingUrl ?? null,
      })
      .eq('id', request.id)
      .throwOnError()
    return NextResponse.json({
      status: 'awaiting_recipient',
      onboardingUrl: invite.onboardingUrl,
    })
  } catch (e) {
    await rollback('recipient invite failed', e)
    return NextResponse.json(
      { error: 'Withdrawal failed. Our team has been notified and will follow up.' },
      { status: 500 }
    )
  }
}
