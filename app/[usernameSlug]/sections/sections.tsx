import 'server-only'
import Link from 'next/link'
import { GiftIcon, HeartIcon } from '@heroicons/react/20/solid'
import { getResponseByProfileId } from '@/db/donor-survey'
import { Profile } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getFollowing, isFollowing } from '@/db/profile-follows'
import { RichContent } from '@/components/editor'
import { DonateBox } from '@/components/donate-box'
import { FollowButton } from '@/components/follows/follow-button'
import { SectionNav, type Section } from '@/components/section-nav'
import { formatMoneyPrecise } from '@/utils/formatting'
import type { Following } from '@/db/profile-follows'
import { BalanceDisplay } from '../balance-display'
import { SuperBanButton } from '../superban-dialog'
import { ActiveBids } from '../profile-active-bids'
import { ProposalBids } from '../profile-proposal-bids'
import { Investments } from '../profile-investments'
import {
  PAGE_SIZE,
  getLedger,
  getProfileComments,
  getProfileProjects,
  getViewer,
  getViewerFunds,
} from '../profile-data'
import { ProjectGrid } from './project-grid'
import { CommentList } from './comment-list'
import { DonationList, TxnTable } from './donation-list'
import { FollowsSummary } from './follows-summary'
import { HEADING_CLASS, SECTION_CLASS } from './styles'

// A profile's parts, each its own server component so the page can stream them in as their data arrives.

type Props = { profile: Profile; isOwn: boolean }

export const firstName = (profile: Profile) => (profile.full_name || profile.username).split(' ')[0]

const firstPage = <T,>(rows: T[]) => ({
  items: rows.slice(0, PAGE_SIZE),
  next: rows.length > PAGE_SIZE ? PAGE_SIZE : null,
})

// Projects, Comments, Donations, Transactions: sections with nothing in them are left out for visitors.
// The bar lists the same sections, with their counts.
export const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'comments', label: 'Comments' },
  { id: 'donations', label: 'Donations' },
  { id: 'transactions', label: 'Transactions' },
] as const

// (The Following list's own followingCount lives in a client module, which the server can't call.)
const followingCount = (f: Following) => f.people.length + f.projects.length + f.searches.length

const getFollowingFor = async (profileId: string, isOwn: boolean) =>
  getFollowing(await createServerSupabaseClient(), profileId, isOwn)

async function sectionCounts(profile: Profile, isOwn: boolean) {
  const [ledger, projects, comments, following] = await Promise.all([
    getLedger(profile.id, profile.accreditation_status, isOwn),
    getProfileProjects(profile.id, isOwn),
    getProfileComments(profile.id, isOwn),
    getFollowingFor(profile.id, isOwn),
  ])
  const legacy = ledger.proposalBids.length + ledger.activeBids.length + ledger.investments.length
  return {
    about:
      !!profile.long_description ||
      followingCount(following) > 0 ||
      showsBalance(profile, isOwn, ledger),
    projects: projects.ids.length,
    comments: comments.total,
    donations: ledger.donations.length,
    donationsShown: ledger.donations.length + legacy > 0,
    transactions: ledger.txns.length,
  }
}

export async function ProfileNav({ profile, isOwn }: Props) {
  const counts = await sectionCounts(profile, isOwn)
  const shown: Record<string, boolean> = {
    about: counts.about,
    projects: counts.projects > 0 || isOwn,
    comments: counts.comments > 0 || isOwn,
    donations: counts.donationsShown || isOwn,
    transactions: counts.transactions > 0,
  }
  const stats: Record<string, number> = {
    projects: counts.projects,
    comments: counts.comments,
    donations: counts.donations,
    transactions: counts.transactions,
  }
  const sections: Section[] = SECTIONS.filter((s) => shown[s.id]).map((s) => ({
    id: s.id,
    label: s.label,
    stat: stats[s.id] ? `${stats[s.id]}` : undefined,
  }))
  return <SectionNav sections={sections} />
}

// "Gave $48,210 to 31 projects and 4 regrantors since 2023": what most tells you about someone on Manifund
export async function GivingLine({ profile, isOwn }: Props) {
  const { gave } = await getLedger(profile.id, profile.accreditation_status, isOwn)
  if (gave.total < 1) return null
  const parts = [
    gave.projects > 0 && `${gave.projects} ${gave.projects === 1 ? 'project' : 'projects'}`,
    gave.people > 0 &&
      `${gave.people} ${gave.people === 1 ? 'regrantor or fund' : 'regrantors and funds'}`,
  ].filter(Boolean)
  const year = gave.since ? new Date(gave.since).getUTCFullYear() : null
  return (
    <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-[15px] text-orange-950">
      <HeartIcon className="mt-0.5 h-4 w-4 flex-none text-orange-500" aria-hidden />
      <span>
        {isOwn ? 'You’ve given' : 'Has given'} {formatMoneyPrecise(gave.total)}
        {parts.length > 0 && ` to ${parts.join(' and ')}`}
        {year && ` since ${year}`}
      </span>
    </p>
  )
}

// Follow, for signed-in visitors (F1); superban, for admins
export async function HeaderActions({ profile, isOwn }: Props) {
  const viewer = await getViewer()
  if (!viewer || isOwn) return null
  const supabase = await createServerSupabaseClient()
  const [following, banInfo] = await Promise.all([
    isFollowing(supabase, viewer.id, profile.id),
    viewer.isAdmin
      ? Promise.all([
          supabase.from('projects').select('title').eq('creator', profile.id),
          supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('commenter', profile.id),
        ])
      : null,
  ])
  return (
    <>
      {banInfo && (
        <SuperBanButton
          profile={profile}
          projectTitles={(banInfo[0].data ?? []).map((p) => p.title)}
          commentCount={banInfo[1].count ?? 0}
        />
      )}
      <FollowButton followedId={profile.id} following={following} />
    </>
  )
}

// Their donor survey answers, when public, and for the donor themself so they can find the page
export async function DonorLink({ profile, isOwn }: Props) {
  const response = await getResponseByProfileId(profile.id)
  if (!response || !(response.is_public || isOwn)) return null
  return (
    <Link
      href={`/${profile.username}/donor`}
      className="inline-flex items-center gap-1 text-orange-600 hover:underline"
    >
      <GiftIcon className="h-3.5 w-3.5" aria-hidden />
      Donor survey answers
    </Link>
  )
}

// Whether to show someone's balance: always on your own profile and a regrantor's; for anyone else, once
// money has moved through their account
const showsBalance = (profile: Profile, isOwn: boolean, ledger: { txns: unknown[] }) =>
  isOwn || profile.regranter_status || ledger.txns.length > 0

// Who they are in their own words, their balance (with the box to give to a regrantor's budget, E15), then what
// they follow (F9)
export async function AboutSection({ profile, isOwn }: Props) {
  const [following, ledger, viewerFunds] = await Promise.all([
    getFollowingFor(profile.id, isOwn),
    getLedger(profile.id, profile.accreditation_status, isOwn),
    profile.regranter_status && !isOwn ? getViewerFunds() : null,
  ])
  const hasFollows = followingCount(following) > 0
  const balance = showsBalance(profile, isOwn, ledger)
  if (!profile.long_description && !hasFollows && !balance && !isOwn) return null
  return (
    <section id="about" className="flex scroll-mt-20 flex-col gap-10">
      {profile.long_description ? (
        <RichContent
          content={profile.long_description}
          className="text-gray-700 [&_a:hover]:text-orange-800 [&_a:hover]:decoration-orange-500 [&_a]:font-normal [&_a]:underline [&_a]:decoration-orange-300 [&_a]:underline-offset-2 [&_a]:transition-colors"
        />
      ) : isOwn ? (
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-gray-500">
          Say who you are and what you work on, so people know whose projects and comments these
          are.{' '}
          <Link href="/edit-profile" className="text-orange-600 hover:underline">
            Write your About
          </Link>
        </p>
      ) : null}
      {(balance || viewerFunds) && (
        <div className="flex flex-col gap-4">
          {balance && (
            <BalanceDisplay
              balance={ledger.balance}
              cashBalance={ledger.cashBalance}
              charityBalance={ledger.charityBalance}
              pending={ledger.pending}
              accredited={profile.accreditation_status}
              isOwnProfile={isOwn}
              userId={isOwn ? profile.id : undefined}
              regrantor={profile.regranter_status}
            />
          )}
          {viewerFunds && (
            <DonateBox
              charity={profile}
              profile={viewerFunds.profile}
              maxDonation={viewerFunds.charityBalance}
            />
          )}
        </div>
      )}
      {(hasFollows || isOwn) && (
        <FollowsSummary following={following} isOwnProfile={isOwn} firstName={firstName(profile)} />
      )}
    </section>
  )
}

export async function ProjectsSection({ profile, isOwn }: Props) {
  const { ids, first } = await getProfileProjects(profile.id, isOwn)
  if (ids.length === 0 && !isOwn) return null
  return (
    <section id="projects" className={SECTION_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={HEADING_CLASS}>Projects</h2>
        {isOwn && (
          <Link href="/create" className="text-[13px] text-orange-600 hover:underline">
            Start a project
          </Link>
        )}
      </div>
      {ids.length === 0 ? (
        <p className="text-[15px] text-gray-500">
          You haven’t proposed a project yet.{' '}
          <Link href="/create" className="text-orange-600 hover:underline">
            Propose one
          </Link>{' '}
          and it will be listed here.
        </p>
      ) : (
        <ProjectGrid
          profileId={profile.id}
          first={{ items: first, next: ids.length > PAGE_SIZE ? PAGE_SIZE : null }}
          total={ids.length}
          isOwn={isOwn}
        />
      )}
    </section>
  )
}

export async function CommentsSection({ profile, isOwn }: Props) {
  const [{ total, first }, viewerFunds] = await Promise.all([
    getProfileComments(profile.id, isOwn),
    getViewerFunds(),
  ])
  if (total === 0 && first.items.length === 0 && !isOwn) return null
  return (
    <section id="comments" className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Comments</h2>
      {first.items.length === 0 ? (
        <p className="text-[15px] text-gray-500">
          Comments you write on projects and orgs will be collected here.
        </p>
      ) : (
        <CommentList
          profile={profile}
          first={first}
          total={total}
          userProfile={viewerFunds.profile}
          userCharityBalance={viewerFunds.charityBalance}
        />
      )}
    </section>
  )
}

export async function DonationsSection({ profile, isOwn }: Props) {
  const ledger = await getLedger(profile.id, profile.accreditation_status, isOwn)
  const { donations, proposalBids, activeBids, investments } = ledger
  const hasLegacy = proposalBids.length + activeBids.length + investments.length > 0
  if (donations.length === 0 && !hasLegacy && !isOwn) return null
  return (
    <section id="donations" className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Donations</h2>
      {donations.length > 0 ? (
        <DonationList
          profileId={profile.id}
          first={firstPage(donations)}
          total={donations.length}
        />
      ) : (
        !hasLegacy && (
          <p className="text-[15px] text-gray-500">
            Your donations and pending offers will be listed here.{' '}
            <Link href="/projects" className="text-orange-600 hover:underline">
              Find a project to fund
            </Link>
          </p>
        )
      )}
      {hasLegacy && (
        <div className="mt-4 flex flex-col gap-6 font-normal">
          {investments.length > 0 && <Investments investments={investments} />}
          {activeBids.length > 0 && <ActiveBids bids={activeBids} isOwnProfile={isOwn} />}
          {proposalBids.length > 0 && <ProposalBids bids={proposalBids} isOwnProfile={isOwn} />}
        </div>
      )}
    </section>
  )
}

export async function TransactionsSection({ profile, isOwn }: Props) {
  const { txns } = await getLedger(profile.id, profile.accreditation_status, isOwn)
  if (txns.length === 0) return null
  return (
    <section id="transactions" className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Transactions</h2>
      <TxnTable profileId={profile.id} first={firstPage(txns)} total={txns.length} />
    </section>
  )
}
