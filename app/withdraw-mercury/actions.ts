'use server'

import { getUser } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { revalidatePath } from 'next/cache'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { getBidsByUser } from '@/db/bid'
import { calculateCashBalance } from '@/utils/math'

const MERCURY_API = 'https://api.mercury.com/api/v1'

function mercuryHeaders() {
  return {
    Authorization: `Bearer ${process.env.MERCURY_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export type BankAccountInfo = {
  accountNumber: string
  routingNumber: string
  electronicAccountType:
    | 'personalChecking'
    | 'personalSavings'
    | 'businessChecking'
    | 'businessSavings'
  address: {
    address1: string
    address2?: string
    city: string
    region: string
    postalCode: string
    country: string
  }
}

export type InternationalWireInfo = {
  swiftCode: string
  iban: string
  address: {
    address1: string
    address2?: string
    city: string
    region: string
    postalCode: string
    country: string
  }
  bankDetails: {
    bankName: string
    bankCountry: string
    cityState: string
  }
  correspondentInfo?: {
    bankName: string
    routingNumber?: string
    swiftCode?: string
  }
  countrySpecific?: Record<string, string>
}

export type RecipientInput =
  | { type: 'domestic'; bankInfo: BankAccountInfo }
  | { type: 'international'; wireInfo: InternationalWireInfo }

type ActionResult<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string }

export async function createMercuryRecipient(
  input: RecipientInput
): Promise<ActionResult<{ recipientId: string }>> {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user?.email) return { success: false, error: 'Not logged in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, mercury_recipient_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { success: false, error: 'Profile not found' }
  if (profile.mercury_recipient_id) {
    return { success: false, error: 'Bank account already connected' }
  }

  const routingInfo =
    input.type === 'domestic'
      ? { electronicRoutingInfo: input.bankInfo }
      : { internationalWireRoutingInfo: input.wireInfo }

  const response = await fetch(`${MERCURY_API}/recipients`, {
    method: 'POST',
    headers: mercuryHeaders(),
    body: JSON.stringify({
      name: profile.full_name,
      emails: [user.email],
      ...routingInfo,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('Mercury create recipient error:', text)
    return { success: false, error: `Mercury API error: ${response.status}` }
  }

  const { id: recipientId } = await response.json()

  const { error } = await supabase
    .from('profiles')
    .update({ mercury_recipient_id: recipientId })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to save recipient ID:', error)
    return { success: false, error: 'Failed to save recipient ID' }
  }

  revalidatePath('/withdraw-mercury')
  return { success: true, recipientId }
}

export async function withdrawViaMercury(
  amount: number
): Promise<ActionResult<{ transactionId: string }>> {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) return { success: false, error: 'Not logged in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('mercury_recipient_id, full_name, accreditation_status')
    .eq('id', user.id)
    .single()

  if (!profile?.mercury_recipient_id) {
    return { success: false, error: 'No bank account connected' }
  }

  // Verify balance
  const [txns, bids] = await Promise.all([
    getTxnAndProjectsByUser(supabase, user.id),
    getBidsByUser(supabase, user.id),
  ])
  const balance = calculateCashBalance(
    txns,
    bids,
    user.id,
    profile.accreditation_status
  )

  if (amount <= 0 || amount > balance) {
    return {
      success: false,
      error: `Invalid amount. Available: $${balance.toFixed(2)}`,
    }
  }

  const accountId = process.env.MERCURY_GRANTS_ACCOUNT_ID
  if (!accountId) {
    return { success: false, error: 'Mercury account not configured' }
  }

  const txnId = crypto.randomUUID()

  // Record the withdrawal txn in our DB
  const { error: insertError } = await supabase.from('txns').insert({
    id: txnId,
    from_id: user.id,
    to_id: process.env.NEXT_PUBLIC_PROD_BANK_ID ?? '',
    amount,
    token: 'USD',
    type: 'withdraw',
  })
  if (insertError) {
    console.error('Failed to create txn:', insertError)
    return { success: false, error: 'Failed to record transaction' }
  }

  // Request Mercury to send the money
  const response = await fetch(
    `${MERCURY_API}/account/${accountId}/request-send-money`,
    {
      method: 'POST',
      headers: mercuryHeaders(),
      body: JSON.stringify({
        recipientId: profile.mercury_recipient_id,
        amount,
        paymentMethod: 'ach',
        idempotencyKey: txnId,
        note: `Manifund withdrawal for ${profile.full_name} (${txnId})`,
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    console.error('Mercury send money error:', text)
    // Roll back the txn record
    await supabase.from('txns').delete().eq('id', txnId)
    return { success: false, error: `Mercury API error: ${response.status}` }
  }

  const data = await response.json()

  await supabase.from('stripe_txns').insert({
    session_id: `mercury_${data.id ?? txnId}`,
    customer_id: user.id,
    amount,
    txn_id: txnId,
  })

  return { success: true, transactionId: txnId }
}
