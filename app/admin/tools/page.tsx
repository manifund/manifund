import { createAdminClient } from '@/db/edge'
import { Donations } from '../donations'
import { RoundBidAmounts } from '../round-bid-amounts'
import { requireAdmin } from '@/lib/require-admin'

export default async function ToolsPage() {
  await requireAdmin() // before any admin-client read: the layout's check alone doesn't stop the page
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
