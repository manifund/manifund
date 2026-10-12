import { createServerSupabaseClient } from '@/db/supabase-server'
import { getFullProjectsByCause } from '@/db/project'
import Image from 'next/image'
import { getCause, listSimpleCauses } from '@/db/cause'
import { CauseTabs } from './cause-tabs'
import { CauseData } from './cause-data'
import { getUser, getProfilesWithRoles } from '@/db/profile'
import { calculateCharityBalance } from '@/utils/math'
import { getIncomingTxnsByUserWithDonor, getMatchTxns, getTxnAndProjectsByUser } from '@/db/txn'
import { getMatchBids, getPendingBidsByUser } from '@/db/bid'
import { getProfileById } from '@/db/profile'
import { MATCH_END, MATCH_START } from './qf'
import { notFound } from 'next/navigation'

export const revalidate = 60

export async function generateMetadata(props: { params: Promise<{ causeSlug: string }> }) {
  const { causeSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const cause = await getCause(supabase, causeSlug)
  return {
    title: cause?.title ?? 'Cause not found',
  }
}

export default async function CausePage(props: { params: Promise<{ causeSlug: string }> }) {
  const { causeSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const [cause, causesList, user] = await Promise.all([
    getCause(supabase, causeSlug),
    listSimpleCauses(supabase),
    getUser(supabase),
  ])
  if (!cause) {
    notFound()
  }
  const [
    projects,
    fund,
    fundTxns,
    userTxns,
    userBids,
    userProfile,
    [profiles, matchTxns, matchBids],
  ] = await Promise.all([
    getFullProjectsByCause(supabase, cause.slug),
    cause.fund_id ? getProfileById(supabase, cause.fund_id) : undefined,
    cause.fund_id ? getIncomingTxnsByUserWithDonor(supabase, cause.fund_id) : [],
    user ? getTxnAndProjectsByUser(supabase, user.id) : [],
    user ? getPendingBidsByUser(supabase, user.id) : [],
    user ? getProfileById(supabase, user.id) : null,
    causeSlug === 'ea-community-choice'
      ? Promise.all([
          getProfilesWithRoles(supabase),
          getMatchTxns(supabase, causeSlug, MATCH_START, MATCH_END),
          getMatchBids(supabase, causeSlug, MATCH_START, MATCH_END),
        ])
      : [],
  ])
  const charityBalance = userProfile
    ? calculateCharityBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
    : 0

  return (
    <div className="bg-dark-200 mx-auto max-w-4xl p-6">
      {cause.header_image_url && (
        <Image
          src={cause.header_image_url}
          width={1000}
          height={500}
          className="relative aspect-[3/1] w-full flex-shrink-0 rounded bg-white object-cover"
          alt="header image"
        />
      )}
      <h1 className="mb-1 mt-3 text-3xl font-bold lg:text-4xl">{cause.title}</h1>
      <CauseData projects={projects} />
      <CauseTabs
        cause={cause}
        projects={projects}
        causesList={causesList}
        fund={fund}
        fundTxns={fundTxns}
        userId={user?.id}
        charityBalance={charityBalance}
        profiles={profiles}
        matchTxns={matchTxns}
        matchBids={matchBids}
      />
    </div>
  )
}
