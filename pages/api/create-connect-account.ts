import { createAdminClient, getUserAndClient } from '@/db/edge'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/utils/stripe'
export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
  unstable_allowDynamic: ['**/node_modules/function-bind/implementation.js'],
}

export default async function handler(req: NextRequest) {
  const { user } = await getUserAndClient(req)
  if (!user) {
    return NextResponse.error()
  }
  const account = await stripe.accounts.create({
    type: 'express',
    email: user.email,
  })
  // Payout accounts are set by the server only
  await createAdminClient()
    .from('profiles')
    .update({ stripe_connect_id: account.id })
    .eq('id', user.id)
    .throwOnError()
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://manifund.org/withdraw',
    return_url: 'https://manifund.org/withdraw',
    type: 'account_onboarding',
  })
  if (!accountLink) {
    console.log('no account link')
    return NextResponse.error()
  }
  return NextResponse.json({ url: accountLink.url })
}
