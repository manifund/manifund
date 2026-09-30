import { RichContent } from '@/components/editor'
import { getFundByUsername, getUser, Profile, getProfileById } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getTxnAndProjectsByUser, getIncomingTxnsByUserWithDonor } from '@/db/txn'
import { getPendingBidsByUser } from '@/db/bid'
import { calculateCharityBalance } from '@/utils/math'
import Image from 'next/image'
import { DonateSection } from './donate-section'
import Link from 'next/link'
import { buttonClass } from '@/components/button'
import clsx from 'clsx'
import { Row } from '@/components/layout/row'
import { ExpandableDonationsHistory } from '@/components/donations-history'
import { notFound } from 'next/navigation'

export default async function FundPage(props: { params: Promise<{ fundSlug: string }> }) {
  const { fundSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  const fund = await getFundByUsername(supabase, fundSlug)
  if (!fund) {
    notFound()
  }
  const fundTxns = await getIncomingTxnsByUserWithDonor(supabase, fund.id)
  const userTxns = user ? await getTxnAndProjectsByUser(supabase, user.id) : []
  const userBids = user ? await getPendingBidsByUser(supabase, user.id) : []
  const userProfile = user ? await getProfileById(supabase, user.id) : null
  const charityBalance = userProfile
    ? calculateCharityBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
    : 0
  return (
    <div className="p-5">
      {fund.avatar_url && (
        <Image
          src={fund.avatar_url}
          width={1000}
          height={500}
          className="relative aspect-[4/1] w-full flex-shrink-0 rounded bg-white object-cover"
          alt="fund header image"
        />
      )}
      <h1 className="mt-4 text-4xl font-bold">{fund.full_name} fund</h1>
      <span className="text-gray-600">{fund.bio}</span>
      {!user && (
        <Row className="my-10 justify-center">
          <Link className={clsx(buttonClass('xl', 'gradient'), 'font-semibold')} href="/login">
            Sign in to donate
          </Link>
        </Row>
      )}
      <DonateSection userId={user?.id} fund={fund as Profile} charityBalance={charityBalance} />
      <ExpandableDonationsHistory donations={fundTxns} />
      <RichContent className="mt-6" content={fund.long_description} />
    </div>
  )
}
