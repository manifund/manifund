import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import { getFullTxnsByUser } from '@/db/txn'
import { getBidsByUser } from '@/db/bid'
import { calculateCashBalance } from '@/utils/math'
import { getKnownPaymentMethod, getOpenWithdrawalRequest } from '@/db/withdrawal-request'
import AuthModal from '@/components/auth/AuthModal'
import { WithdrawRequestForm } from './withdraw-request-form'

export const dynamic = 'force-dynamic'

export default async function WithdrawRequestPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) {
    return <AuthModal isOpen={true} />
  }
  const [profile, txns, bids] = await Promise.all([
    getProfileById(supabase, user.id),
    getFullTxnsByUser(supabase, user.id),
    getBidsByUser(supabase, user.id),
  ])
  if (!profile) {
    return null
  }
  const withdrawBalance = calculateCashBalance(txns, bids, user.id, profile.accreditation_status)
  const openRequest = await getOpenWithdrawalRequest(supabase, user.id)
  const knownPaymentMethod = profile.mercury_recipient_id
    ? await getKnownPaymentMethod(supabase, user.id, profile.mercury_recipient_id)
    : null

  return (
    <WithdrawRequestForm
      withdrawBalance={withdrawBalance}
      openRequest={openRequest}
      hasRecipient={!!profile.mercury_recipient_id}
      knownPaymentMethod={knownPaymentMethod}
    />
  )
}
