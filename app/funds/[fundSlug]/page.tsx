import { getFundByUsername, getUser, getProfileById } from '@/db/profile'
import { getFundAdmins } from '@/db/fund'
import { createServerSupabaseClient } from '@/db/supabase-server'
import {
  getTxnAndProjectsByUser,
  getFullTxnsByUser,
  getIncomingTxnsByUserWithDonor,
} from '@/db/txn'
import { getBidsByUser, getPendingBidsByUser } from '@/db/bid'
import { getFullProjectsByCause, getFullProjectsByIds } from '@/db/project'
import { listSimpleCauses } from '@/db/cause'
import { calculateCharityBalance } from '@/utils/math'
import { formatMoney } from '@/utils/formatting'
import { Stat } from '@/components/stat'
import { DonateBox } from '@/components/donate-box'
import { UserAvatarAndBadge } from '@/components/user-link'
import { Row } from '@/components/layout/row'
import { Col } from '@/components/layout/col'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { orderBy, uniqBy } from 'es-toolkit'
import { FundTabs, type GrantAmount } from './fund-tabs'

export async function generateMetadata(props: { params: Promise<{ fundSlug: string }> }) {
  const { fundSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const fund = await getFundByUsername(supabase, fundSlug)
  return { title: fund?.full_name ?? 'Fund not found', description: fund?.bio || undefined }
}

export default async function FundPage(props: { params: Promise<{ fundSlug: string }> }) {
  const { fundSlug } = await props.params
  const supabase = await createServerSupabaseClient()
  const [fund, user] = await Promise.all([getFundByUsername(supabase, fundSlug), getUser(supabase)])
  if (!fund) {
    notFound()
  }
  const [
    admins,
    fundTxns,
    incomingTxns,
    fundBids,
    causes,
    causesList,
    userProfile,
    userTxns,
    userBids,
  ] = await Promise.all([
    getFundAdmins(supabase, fund.id),
    getFullTxnsByUser(supabase, fund.id),
    getIncomingTxnsByUserWithDonor(supabase, fund.id),
    getBidsByUser(supabase, fund.id),
    supabase.from('causes').select('slug, open').eq('fund_id', fund.id).throwOnError(),
    listSimpleCauses(supabase),
    user ? getProfileById(supabase, user.id) : undefined,
    user ? getTxnAndProjectsByUser(supabase, user.id) : [],
    user ? getPendingBidsByUser(supabase, user.id) : [],
  ])
  // Projects tagged with any of the fund's causes are its applications (F6).
  const applications = uniqBy(
    (
      await Promise.all(
        (causes.data ?? []).map((cause) => getFullProjectsByCause(supabase, cause.slug))
      )
    ).flat(),
    (project) => project.id
  )
  const hasCause = (causes.data ?? []).length > 0
  const applySlug = causes.data?.find((cause) => cause.open)?.slug

  // F4: raised is every dollar given to the fund, granted every dollar it has given out.
  const usdTxns = fundTxns.filter((txn) => txn.token === 'USD' && txn.from_id !== txn.to_id)
  const raised = usdTxns
    .filter((txn) => txn.to_id === fund.id)
    .reduce((sum, txn) => sum + txn.amount, 0)
  const grants = usdTxns.filter(
    (txn) =>
      txn.from_id === fund.id &&
      (txn.type === 'project donation' || txn.type === 'profile donation')
  )
  const granted = grants.reduce((sum, txn) => sum + txn.amount, 0)
  const pendingOffers = fundBids.filter((bid) => bid.status === 'pending' && bid.type === 'donate')
  // What the fund gave or has offered each project, shown above its card (F5)
  const grantAmounts: Record<string, GrantAmount> = {}
  const addGrant = (
    projectId: string,
    field: 'granted' | 'offered',
    amount: number,
    at: string
  ) => {
    const entry = (grantAmounts[projectId] ??= { granted: 0, offered: 0, latest: at })
    entry[field] += amount
    if (at > entry.latest) entry.latest = at
  }
  for (const txn of grants) {
    if (txn.project) addGrant(txn.project, 'granted', txn.amount, txn.created_at)
  }
  for (const bid of pendingOffers) addGrant(bid.project, 'offered', bid.amount, bid.created_at)
  const grantProjects = orderBy(
    await getFullProjectsByIds(supabase, Object.keys(grantAmounts)),
    [(project) => grantAmounts[project.id].latest],
    ['desc']
  )
  const available = calculateCharityBalance(
    fundTxns,
    pendingOffers,
    fund.id,
    fund.accreditation_status
  )
  const userCharityBalance = userProfile
    ? calculateCharityBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
    : 0
  return (
    <div className="mx-auto max-w-4xl p-6">
      {fund.avatar_url && (
        <Image
          src={fund.avatar_url}
          width={1000}
          height={250}
          className="relative aspect-[4/1] w-full flex-shrink-0 rounded bg-white object-cover"
          alt=""
        />
      )}
      <h1 className="mb-1 mt-4 text-3xl font-bold lg:text-4xl">{fund.full_name}</h1>
      {fund.bio && <p className="text-gray-600">{fund.bio}</p>}
      {admins.length > 0 && (
        <Row className="mt-3 flex-wrap items-center gap-3 text-sm text-gray-500">
          Run by
          {admins.map((admin) => (
            <UserAvatarAndBadge key={admin.id} profile={admin} />
          ))}
        </Row>
      )}
      <Col className="my-4 gap-6 border-y border-gray-200 py-6">
        <div className="flex justify-between">
          <Stat value={formatMoney(raised)} label="raised" />
          <Stat value={formatMoney(granted)} label="granted" />
          {/* Older funds paid some grants with money that never came through Manifund */}
          <Stat value={formatMoney(Math.max(available, 0))} label="available to grant" />
        </div>
        <DonateBox charity={fund} profile={userProfile} maxDonation={userCharityBalance} />
      </Col>
      <div className="mt-2">
        <FundTabs
          fund={fund}
          grantProjects={grantProjects}
          grantAmounts={grantAmounts}
          otherGrants={grants.filter((txn) => !txn.project)}
          donations={incomingTxns.filter((txn) => txn.token === 'USD' && txn.from_id !== fund.id)}
          applications={applications}
          hasCause={hasCause}
          applySlug={applySlug}
          causesList={causesList}
        />
      </div>
    </div>
  )
}
