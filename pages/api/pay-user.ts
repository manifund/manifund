import { getProfileById, isAdmin } from '@/db/profile'
import { getUserEmail, TEMPLATE_IDS } from '@/utils/email'
import { notify, templateEmail } from '@/lib/notifications/notify'
import { NextRequest, NextResponse } from 'next/server'
import uuid from 'react-uuid'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import type { TablesInsert } from '@/db/database.types'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export type PayUserProps = {
  userId: string
  amount: number
  sendDonationReceipt?: boolean
  // Donor fee taken straight back out of a deposit; the receipt still covers the full amount
  fee?: number
}

export default async function handler(req: NextRequest) {
  const { user } = await getUserAndClient(req)
  if (!user || !isAdmin(user)) return Response.error()

  const { userId, amount, sendDonationReceipt, fee = 0 } = (await req.json()) as PayUserProps
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: 'amount must be a nonzero number' }, { status: 400 })
  }
  if (fee !== 0 && !(amount > 0 && Number.isFinite(fee) && fee > 0 && fee < amount)) {
    return NextResponse.json(
      { error: 'fee must be positive and less than a positive amount' },
      { status: 400 }
    )
  }
  const bankId = process.env.NEXT_PUBLIC_PROD_BANK_ID as string
  // Interpret negative amounts as payments to the bank
  const isDeposit = amount > 0
  const txnId = uuid()
  const bundle = fee ? uuid() : null
  const txns: TablesInsert<'txns'>[] = [
    {
      id: txnId,
      amount: Math.abs(amount),
      from_id: isDeposit ? bankId : userId,
      to_id: isDeposit ? userId : bankId,
      token: 'USD',
      type: isDeposit ? 'deposit' : 'withdraw',
      bundle,
    },
  ]
  if (fee) {
    txns.push({
      id: uuid(),
      amount: fee,
      from_id: userId,
      to_id: bankId,
      token: 'USD',
      type: 'fee',
      bundle,
    })
  }

  const supabaseAdmin = createAdminClient()
  const { data } = await supabaseAdmin.from('txns').insert(txns).select().throwOnError()
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

  return NextResponse.json(data)
}
