import { createAdminClient } from '@/db/edge'
import { Donations } from '../donations'
import { RoundBidAmounts } from '../round-bid-amounts'

export default async function ToolsPage() {
  const supabaseAdmin = createAdminClient()
  const { data: profiles } = await supabaseAdmin.from('profiles').select('*').eq('type', 'org')
  const { data: txns } = await supabaseAdmin.from('txns').select('*').eq('token', 'USD')

  return (
    <>
      <Donations charities={profiles ?? []} txns={txns ?? []} />
      <h2 className="text-lg">Round Bid Amounts</h2>
      <RoundBidAmounts />
    </>
  )
}
