'use server'

import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { getBidsByUser } from '@/db/bid'
import { calculateCashBalance } from '@/utils/math'
import AuthModal from '@/components/auth/AuthModal'
import { BankInfoForm, WithdrawForm } from './withdraw-mercury-client'

export default async function WithdrawMercuryPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) return <AuthModal isOpen={true} />

  const profile = await getProfileById(supabase, user.id)
  if (!profile) return null

  // If no Mercury recipient yet, show the bank info form
  if (!profile.mercury_recipient_id) {
    return <BankInfoForm />
  }

  // Fetch Mercury recipient details and balance in parallel
  const [recipientData, txns, bids] = await Promise.all([
    fetchMercuryRecipient(profile.mercury_recipient_id),
    getTxnAndProjectsByUser(supabase, user.id),
    getBidsByUser(supabase, user.id),
  ])

  const withdrawBalance = calculateCashBalance(
    txns,
    bids,
    user.id,
    profile.accreditation_status
  )

  return (
    <WithdrawForm
      recipientName={recipientData?.name ?? profile.full_name}
      accountLastFour={recipientData?.accountLastFour}
      accountType={recipientData?.accountType}
      balance={withdrawBalance}
    />
  )
}

async function fetchMercuryRecipient(recipientId: string) {
  const apiKey = process.env.MERCURY_API_KEY
  if (!apiKey) throw new Error('No Mercury API key')

  const res = await fetch(
    `https://api.mercury.com/api/v1/recipient/${recipientId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  const data = await res.json()
  if (!res.ok)
    throw new Error(
      'Failed to fetch Mercury recipient: ' + JSON.stringify(data)
    )
  return {
    name: data.name as string,
    accountLastFour: data.electronicRoutingInfo?.accountNumber?.slice(-4) as
      | string
      | undefined,
    accountType: data.electronicRoutingInfo?.electronicAccountType as
      | string
      | undefined,
  }
}
