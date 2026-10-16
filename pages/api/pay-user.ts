import { PayUserProps } from '@/app/admin/pay-user'
import { getProfileById, isAdmin } from '@/db/profile'
import { getUserEmail, TEMPLATE_IDS } from '@/utils/email'
import { notify, templateEmail } from '@/lib/notifications/notify'
import { NextRequest, NextResponse } from 'next/server'
import uuid from 'react-uuid'
import { createAdminClient, getUserAndClient } from '@/db/edge'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export default async function handler(req: NextRequest) {
  const { supabase: supabaseEdge, user } = await getUserAndClient(req)
  if (!user || !isAdmin(user)) return Response.error()

  const { userId, amount, sendDonationReceipt } = (await req.json()) as PayUserProps
  // Interpret negative amounts as payments to the bank
  const positiveAmount = Math.abs(amount)
  const from_id = amount > 0 ? (process.env.NEXT_PUBLIC_PROD_BANK_ID as string) : userId
  const to_id = amount > 0 ? userId : (process.env.NEXT_PUBLIC_PROD_BANK_ID as string)

  const supabaseAdmin = createAdminClient()
  // Create a new txn paying this user
  const txnId = uuid()
  const { data: txn } = await supabaseAdmin
    .from('txns')
    .insert({
      amount: positiveAmount,
      from_id,
      to_id,
      token: 'USD',
      type: amount > 0 ? 'deposit' : 'withdraw',
    })
    .throwOnError()
  // Send donation receipt if applicable
  if (sendDonationReceipt) {
    const profile = await getProfileById(supabaseAdmin, userId)
    const userEmail = await getUserEmail(supabaseAdmin, userId)
    if (profile && userEmail) {
      await notify({
        to: userId,
        reason: 'payment_received',
        amount,
        email: templateEmail(
          TEMPLATE_IDS.PAYMENT_CONFIRMATION,
          {
            amount,
            id: txnId,
            fullName: profile.full_name,
            email: userEmail,
            destinationName: 'your Manifund account',
          },
          userId,
          userEmail
        ),
      })
    }
  }

  return NextResponse.json(txn)
}
