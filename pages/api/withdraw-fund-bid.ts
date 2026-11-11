import { NextRequest } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { isFundAdmin } from '@/db/fund'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

// F8: a fund admin withdraws one of the fund's pending offers.
export default async function handler(req: NextRequest) {
  const { bidId } = (await req.json()) as { bidId: string }
  const { supabase, user } = await getUserAndClient(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { data: bid } = await supabase
    .from('bids')
    .select('id, bidder, status')
    .eq('id', bidId)
    .maybeSingle()
    .throwOnError()
  if (!bid || bid.status !== 'pending') {
    return new Response('Offer not found', { status: 404 })
  }
  if (!(await isFundAdmin(supabase, bid.bidder, user.id))) {
    return new Response('Unauthorized', { status: 401 })
  }
  await createAdminClient()
    .from('bids')
    .update({ status: 'deleted' })
    .eq('id', bid.id)
    .eq('status', 'pending')
    .throwOnError()
  return new Response('OK')
}
