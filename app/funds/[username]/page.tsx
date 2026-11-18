import Link from 'next/link'
import { notFound } from 'next/navigation'
import { orderBy, uniqBy } from 'es-toolkit'
import { getFundByUsername, getUser, getProfileById } from '@/db/profile'
import { fundFigures, getFundAdmins } from '@/db/fund'
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
import { findFundComment } from '@/utils/fund-comments'
import { toPlaintext } from '@/utils/tiptap-parsing'
import { JSONContent } from '@tiptap/core'
import { formatMoney } from '@/utils/formatting'
import { DonateBox } from '@/components/donate-box'
import { Avatar } from '@/components/avatar'
import { RichContent } from '@/components/editor'
import { ProjectsDisplay } from '@/components/projects-display'
import { DonationsHistory } from '@/components/donations-history'
import { buttonClass } from '@/components/button'
import { OutgoingDonationsHistory } from '@/app/[usernameSlug]/profile-donations'
import { SectionNav, type Section } from '@/components/section-nav'
import { FUND_PAGES } from '../fund-pages'
import { GrantCards, type GrantAmount, type GrantComment } from './grant-cards'
import { SunlightAbout } from './sunlight-about'

export const revalidate = 60

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const supabase = await createServerSupabaseClient()
  const fund = await getFundByUsername(supabase, username)
  const extras = fund ? FUND_PAGES[fund.username] : undefined
  return {
    title: fund?.full_name ?? 'Fund not found',
    description: extras?.mission ?? (fund?.bio || undefined),
  }
}

export default async function FundPage(props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const supabase = await createServerSupabaseClient()
  const [fund, user] = await Promise.all([getFundByUsername(supabase, username), getUser(supabase)])
  if (!fund) {
    notFound()
  }
  const extras = FUND_PAGES[fund.username] ?? {}
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

  const { raised, granted, grants } = fundFigures(fund.id, fundTxns)
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
  const grantProjectIds = Object.keys(grantAmounts)
  const adminIds = admins.map((admin) => admin.id)
  const [unsortedGrantProjects, adminComments] = await Promise.all([
    getFullProjectsByIds(supabase, grantProjectIds),
    grantProjectIds.length > 0 && adminIds.length > 0
      ? supabase
          .from('comments')
          .select(
            'id, project, commenter, created_at, replying_to, deleted_at, held_at, content, profiles!comments_commenter_fkey(id, username, full_name, avatar_url)'
          )
          .in('project', grantProjectIds)
          .in('commenter', adminIds)
          .is('replying_to', null)
          .throwOnError()
          .then((res) => res.data ?? [])
      : [],
  ])
  const grantProjects = orderBy(
    unsortedGrantProjects,
    [(project) => grantAmounts[project.id].latest],
    ['desc']
  )
  // F11: the comment an admin wrote about each grant, linked and quoted under its card
  const firstGiftAt: Record<string, string> = {}
  for (const at of [...grants, ...fundBids]) {
    if (at.project && (!firstGiftAt[at.project] || at.created_at < firstGiftAt[at.project]))
      firstGiftAt[at.project] = at.created_at
  }
  const grantComments: Record<string, GrantComment> = {}
  for (const project of grantProjects) {
    const comment = findFundComment(
      adminComments.filter((c) => c.project === project.id),
      adminIds,
      firstGiftAt[project.id]
    )
    if (!comment) continue
    const author = comment.profiles as unknown as GrantComment['author']
    grantComments[project.id] = {
      href: `/projects/${project.slug}?tab=comments#${comment.id}`,
      author,
      excerpt: comment.content ? toPlaintext(comment.content as JSONContent).slice(0, 400) : '',
    }
  }
  const otherGrants = grants.filter((txn) => !txn.project)
  const grantCount = grantProjects.length + otherGrants.length
  const donations = incomingTxns.filter((txn) => txn.token === 'USD' && txn.from_id !== fund.id)
  const available = calculateCharityBalance(
    fundTxns,
    pendingOffers,
    fund.id,
    fund.accreditation_status
  )
  const userCharityBalance = userProfile
    ? calculateCharityBalance(userTxns, userBids, userProfile.id, userProfile.accreditation_status)
    : 0

  const sections: Section[] = [
    { id: 'about', label: 'About' },
    { id: 'grants', label: 'Grants', stat: grantCount > 0 ? `${grantCount}` : undefined },
    ...(hasCause
      ? [
          {
            id: 'applications',
            label: 'Applications',
            stat: applications.length > 0 ? `${applications.length}` : undefined,
          },
        ]
      : []),
    {
      id: 'donations',
      label: 'Donations',
      stat: donations.length > 0 ? `${donations.length}` : undefined,
    },
  ]
  const cover = extras.cover ?? fund.avatar_url
  const mission = extras.mission ?? fund.bio
  const sectionClass = 'flex scroll-mt-20 flex-col gap-5'
  const headingClass = 'text-2xl font-normal tracking-tight text-gray-900'
  // F4: older funds paid some grants with money that never came through Manifund
  const figures = [
    { label: 'Raised', value: formatMoney(raised) },
    { label: 'Granted', value: formatMoney(granted) },
    { label: 'Available to grant', value: formatMoney(Math.max(available, 0)) },
  ]

  return (
    <div className="px-4 pb-16 pt-7 font-light">
      <div className="flex gap-1.5 text-[13px] text-gray-500">
        <Link href="/funds" className="hover:underline">
          Funds
        </Link>
        <span>/</span>
        <span className="text-gray-900">{fund.full_name}</span>
      </div>

      {/* The cover carries the name and mission; the gradient behind it shows if the image doesn't load. */}
      <header className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="relative flex min-h-[300px] flex-col justify-end px-6 pb-7 pt-24 sm:min-h-[380px] sm:px-10 sm:pb-9">
          <h1 className="text-[40px] font-medium leading-none tracking-tight text-white sm:text-6xl">
            {fund.full_name}
          </h1>
          {mission && (
            <p className="mt-3 max-w-[38ch] text-pretty text-lg leading-snug text-white/90 sm:text-xl">
              {mission}
            </p>
          )}
          {admins.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
              <span>Run by</span>
              {admins.map((admin) => (
                <Link
                  key={admin.id}
                  href={`/${admin.username}`}
                  className="flex items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  <Avatar
                    username={admin.username}
                    avatarUrl={admin.avatar_url}
                    id={admin.id}
                    size={6}
                    noLink
                  />
                  {admin.full_name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <SectionNav sections={sections} />

      {/* Below xl the rail's cards come first: donating, then the facts. */}
      <div className="flex flex-col gap-7 pt-7 xl:flex-row xl:items-start">
        <main className="order-2 flex min-w-0 flex-1 flex-col gap-16 xl:order-1">
          <section id="about" className={sectionClass}>
            {fund.username === 'sunlight' ? (
              <SunlightAbout admins={admins} applySlug={applySlug} />
            ) : fund.long_description ? (
              <RichContent
                content={fund.long_description}
                className="max-w-[720px] text-gray-700"
              />
            ) : (
              <p className="text-gray-500">Nothing written about {fund.full_name} yet.</p>
            )}
          </section>

          <section id="grants" className={sectionClass}>
            <h2 className={headingClass}>Grants</h2>
            {grantCount === 0 ? (
              <p className="max-w-[60ch] text-[15px] leading-relaxed text-gray-500">
                {fund.full_name} hasn’t made any grants yet. Each one will appear here, with how
                much it was for, as soon as it’s made.
              </p>
            ) : (
              <>
                {grantProjects.length > 0 && (
                  <GrantCards
                    projects={grantProjects}
                    amounts={grantAmounts}
                    comments={grantComments}
                  />
                )}
                {otherGrants.length > 0 && (
                  <OutgoingDonationsHistory donations={otherGrants} pendingDonateBids={[]} />
                )}
              </>
            )}
          </section>

          {hasCause && (
            <section id="applications" className={sectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={headingClass}>Applications</h2>
                {applySlug && (
                  <Link href={`/create?prize=${applySlug}`} className={buttonClass('md', 'orange')}>
                    Start an application
                  </Link>
                )}
              </div>
              {applications.length > 0 ? (
                <div className="font-normal">
                  <ProjectsDisplay projects={applications} causesList={causesList} noFilter />
                </div>
              ) : (
                <p className="text-[15px] text-gray-500">
                  {applySlug
                    ? 'No applications yet. Every application is a public proposal, listed here.'
                    : `${fund.full_name} isn’t taking applications yet.`}
                </p>
              )}
            </section>
          )}

          <section id="donations" className={sectionClass}>
            <h2 className={headingClass}>Donations</h2>
            {donations.length > 0 ? (
              <div className="font-normal">
                <DonationsHistory donations={donations} />
              </div>
            ) : (
              <p className="text-[15px] text-gray-500">No donations yet.</p>
            )}
          </section>
        </main>

        <aside className="contents xl:sticky xl:top-16 xl:order-2 xl:flex xl:w-80 xl:flex-none xl:flex-col xl:gap-4">
          <div className="order-1 flex flex-col gap-4">
            <dl className="grid grid-cols-3 rounded-lg bg-white shadow-sm xl:grid-cols-1">
              {figures.map((figure, i) => (
                <div
                  key={figure.label}
                  className={
                    i > 0
                      ? 'border-l border-gray-100 px-5 py-4 xl:flex xl:items-baseline xl:justify-between xl:border-l-0 xl:border-t'
                      : 'px-5 py-4 xl:flex xl:items-baseline xl:justify-between'
                  }
                >
                  <dt className="text-xs text-gray-500 xl:text-sm">{figure.label}</dt>
                  <dd className="mt-1 text-xl font-normal tabular-nums text-gray-900 xl:mt-0 xl:text-lg">
                    {figure.value}
                  </dd>
                </div>
              ))}
            </dl>
            <DonateBox charity={fund} profile={userProfile} maxDonation={userCharityBalance} />
          </div>
          {extras.facts && extras.facts.length > 0 && (
            <div className="order-3 rounded-lg bg-white p-5 shadow-sm">
              <div className="mb-3 text-[13px] font-medium text-gray-900">At a glance</div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
                {extras.facts.map((fact) => (
                  <div key={fact.label} className="contents">
                    <dt className="text-gray-500">{fact.label}</dt>
                    <dd className="text-gray-900">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
