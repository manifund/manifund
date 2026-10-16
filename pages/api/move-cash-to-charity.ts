import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { getProfileById } from '@/db/profile'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { getPendingBidsByUser } from '@/db/bid'
import { calculateCashBalance } from '@/utils/math'
import { TEMPLATE_IDS } from '@/utils/email'
import { notify, templateEmail } from '@/lib/notifications/notify'
import uuid from 'react-uuid'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

export default async function handler(req: NextRequest) {
  const { amount } = (await req.json()) as { amount: number }
  if (amount < 1) {
    // This also prevents negative withdraws
    console.error('amount must be $1 or greater')
    return NextResponse.error()
  }
  const { supabase, user } = await getUserAndClient(req)
  const profile = await getProfileById(supabase, user?.id)
  if (!profile || !user) {
    console.error('no user or profile')
    return NextResponse.error()
  }
  const txns = await getTxnAndProjectsByUser(supabase, user.id)
  const bids = await getPendingBidsByUser(supabase, user.id)
  const cashBalance = calculateCashBalance(txns, bids, user.id, profile.accreditation_status)
  if (amount > cashBalance) {
    console.error('amount too high')
    return NextResponse.error()
  }
  const txnId = uuid()
  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.from('txns').insert({
    id: txnId,
    from_id: user.id,
    to_id: user.id,
    amount: amount,
    token: 'USD',
    type: 'cash to charity transfer',
  })
  if (error) {
    console.error(error)
    return NextResponse.error()
  }
  const postmarkVars = {
    amount: amount,
    name: profile.full_name,
    email: user.email,
    txnId: txnId,
  }
  await notify({
    to: user.id,
    reason: 'cash_to_charity',
    amount,
    email: templateEmail(
      TEMPLATE_IDS.CASH_TO_CHARITY,
      postmarkVars,
      user.id,
      user.email ?? undefined
    ),
  })
  return NextResponse.json('success')
}
