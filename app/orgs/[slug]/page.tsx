import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SparklesIcon } from '@heroicons/react/20/solid'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getOrgBySlug, getOrgProjects, getOrgTrace, type Org } from '@/db/org'
import { getCommentsByTarget } from '@/db/comment'
import { getProfileById, getUser } from '@/db/profile'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { getBidsByUser } from '@/db/bid'
import { calculateCharityBalance } from '@/utils/math'
import { addHttpToUrl, formatMoney } from '@/utils/formatting'
import { formatCompactMoney, summarizeFunding } from '@/utils/org-funding'
import { LEGAL_STRUCTURES } from '@/utils/org-directory'
import { RichContent } from '@/components/editor'
import { ProjectCard } from '@/components/project-card'
import { Tag } from '@/components/tags'
import { buttonClass } from '@/components/button'
import { OrgLogo } from '../org-logo'
import { SectionNav, type Section } from './section-nav'
import { Funding } from './funding'
import { Reviews } from './reviews'
import { manifundUsername } from './manifund-reviews'
import { ASSUMED_RATING } from '../rating'
import { OrgDonateBox } from './org-donate-box'

const TRACE_URL = 'https://trace.manifund.org'
const CONTACT = 'mailto:hi@manifund.org'

const hostname = (url: string) =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createServerSupabaseClient()
  const org = await getOrgBySlug(supabase, slug)
  return org ? { title: org.name, description: org.summary ?? undefined } : {}
}

export default async function OrgPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createServerSupabaseClient()
  const org = await getOrgBySlug(supabase, slug)
  if (!org) notFound()

  const [projects, trace, comments, user] = await Promise.all([
    getOrgProjects(supabase, org.id),
    org.trace_slug ? getOrgTrace(supabase, org.trace_slug) : null,
    getCommentsByTarget(supabase, { org_id: org.id }),
    getUser(supabase),
  ])
  const [profile, txns, bids] = await Promise.all([
    user ? getProfileById(supabase, user.id) : undefined,
    user ? getTxnAndProjectsByUser(supabase, user.id) : [],
    user ? getBidsByUser(supabase, user.id) : [],
  ])
  const userCharityBalance = profile
    ? calculateCharityBalance(txns, bids, profile.id, profile.accreditation_status)
    : 0

  const funding = trace ? summarizeFunding(trace.grants, new Date().getUTCFullYear()) : null
  const showFunding = !!funding && funding.total > 0
  const team = trace?.team && trace.team.people.length > 0 ? trace.team : null
  const leaders = team?.people.filter((person) => person.leadership) ?? []
  const staff = team?.people.filter((person) => !person.leadership) ?? []
  const reviewCount =
    comments.filter((c) => !c.replying_to && !c.deleted_at).length + (trace?.reviews.length ?? 0)

  // Donations go to the org's project that's open for funding: the oldest one, when there are several.
  const openProject = [...projects]
    .reverse()
    .find((project) => project.stage === 'proposal' || project.stage === 'active')

  // "gave $500" beside reviewers who donated to any of the org's projects.
  const given: Record<string, number> = {}
  for (const project of projects) {
    for (const txn of project.txns) {
      if (txn.token === 'USD' && txn.from_id && txn.to_id === project.creator) {
        given[txn.from_id] = (given[txn.from_id] ?? 0) + txn.amount
      }
    }
  }
  const commenterTags = Object.fromEntries(
    Object.entries(given).map(([id, amount]) => [id, `gave ${formatMoney(amount)}`])
  )

  // Trace also collects what people wrote about the org in comments on Manifund projects. Those are by
  // people with profiles here: look them up, so their reviews link to them and carry the same tags.
  const manifundReviewers = (trace?.reviews ?? [])
    .map((review) => manifundUsername(review.reviewerUrl))
    .filter((username): username is string => !!username)
  const { data: reviewerProfiles } = manifundReviewers.length
    ? await supabase
        .from('profiles')
        .select('id, username, regranter_status')
        .in('username', manifundReviewers)
    : { data: [] }
  const reviewers = Object.fromEntries(
    (reviewerProfiles ?? []).map((reviewer) => [
      reviewer.username,
      { regrantor: reviewer.regranter_status, tag: commenterTags[reviewer.id] },
    ])
  )

  const sections: Section[] = [
    { id: 'overview', label: 'Overview' },
    ...(showFunding
      ? [{ id: 'funding', label: 'Funding', stat: formatCompactMoney(funding.total) }]
      : []),
    {
      id: 'reviews',
      label: 'Reviews',
      stat: reviewCount > 0 ? `${ASSUMED_RATING.toFixed(1)}★` : undefined,
    },
    ...(projects.length > 0
      ? [{ id: 'proposals', label: 'Proposals', stat: `${projects.length}` }]
      : []),
    ...(team
      ? [{ id: 'team', label: 'Team', stat: `${team.headcount ?? team.people.length}` }]
      : []),
  ]

  const legal = org.legal_structure ? LEGAL_STRUCTURES[org.legal_structure] : undefined
  const meta = [org.city, org.founded_year ? `Founded ${org.founded_year}` : null].filter(Boolean)
  const sectionClass = 'flex scroll-mt-20 flex-col gap-4'
  const headingClass = 'text-2xl font-normal tracking-tight text-gray-900'

  return (
    <div className="px-4 pb-16 pt-7 font-light">
      <div className="flex gap-1.5 text-[13px] text-gray-500">
        <Link href="/orgs" className="hover:underline">
          Orgs
        </Link>
        <span>/</span>
        <span className="text-gray-900">{org.name}</span>
      </div>

      <header className="mt-5 flex flex-wrap items-start gap-6">
        <OrgLogo org={org} className="h-[88px] w-[88px] rounded-xl text-[22px]" />
        <div className="min-w-0 flex-[1_1_420px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[34px] font-medium leading-tight tracking-tight text-gray-900">
              {org.name}
            </h1>
            {org.legal_name && org.legal_name !== org.name && (
              <span className="text-sm text-gray-500">{org.legal_name}</span>
            )}
          </div>
          {org.summary && (
            <p className="mt-2.5 max-w-[680px] text-pretty text-lg leading-normal text-gray-700">
              {org.summary}
            </p>
          )}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
            {org.cause && <Tag text={org.cause} color="orange" />}
            {legal && <Tag text={legal.short} color="emerald" />}
            {org.focus.map((focus) => (
              <Tag key={focus} text={focus} color="gray" />
            ))}
            {meta.length > 0 && <span>{meta.join(' · ')}</span>}
            {meta.length > 0 && org.website && <span>·</span>}
            {org.website && (
              <a href={addHttpToUrl(org.website)} className="text-orange-600 hover:underline">
                {hostname(org.website)} ↗
              </a>
            )}
          </div>
        </div>
      </header>

      <SectionNav sections={sections} />

      {/* Below xl the rail's cards join this column: donating first, the facts last. */}
      <div className="flex flex-col gap-7 pt-7 xl:flex-row xl:items-start">
        <main className="order-2 flex min-w-0 flex-1 flex-col gap-16 xl:order-1">
          <section id="overview" className={sectionClass}>
            <div>
              {org.about ? (
                <RichContent content={org.about} className="max-w-[720px] text-gray-700" />
              ) : (
                <p className="text-gray-500">Nothing written about {org.name} yet.</p>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                {org.sources.length > 0 && (
                  <>
                    <SparklesIcon className="h-3.5 w-3.5 flex-none" aria-hidden />
                    <span>
                      Compiled from{' '}
                      {org.sources.map((source, i) => (
                        <span key={source}>
                          {i > 0 && ', '}
                          <a href={source} className="text-orange-600 hover:underline">
                            {hostname(source)}
                          </a>
                        </span>
                      ))}
                      {' · '}
                    </span>
                  </>
                )}
                <a
                  href={`${CONTACT}?subject=${encodeURIComponent(`Edit for ${org.name}'s page`)}`}
                  className="text-orange-600 hover:underline"
                >
                  Suggest an edit
                </a>
              </div>
            </div>
          </section>

          {showFunding && trace && (
            <section id="funding" className={sectionClass}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className={headingClass}>Funding</h2>
                <a
                  href={`${TRACE_URL}/orgs/${trace.slug}`}
                  className="text-[13px] text-orange-600 hover:underline"
                >
                  View all {funding.grantCount} grants in Trace →
                </a>
              </div>
              <Funding funding={funding} />
            </section>
          )}

          <section id="reviews" className={sectionClass}>
            <Reviews
              org={org}
              comments={comments}
              externalReviews={trace?.reviews ?? []}
              commenterTags={commenterTags}
              reviewers={reviewers}
              userProfile={profile ?? undefined}
              userCharityBalance={userCharityBalance}
            />
          </section>

          {projects.length > 0 && (
            <section id="proposals" className={sectionClass}>
              <h2 className={headingClass}>Proposals</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 font-normal">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}

          {team && (
            <section id="team" className={sectionClass}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className={headingClass}>Team</h2>
                <span className="text-[13px] text-gray-500">
                  {team.headcount ?? team.people.length} current staff
                  {team.sourceUrl && (
                    <>
                      {' · '}
                      <a href={team.sourceUrl} className="text-orange-600 hover:underline">
                        {hostname(team.sourceUrl)} ↗
                      </a>
                    </>
                  )}
                </span>
              </div>
              <div>
                {leaders.length > 0 && (
                  <>
                    <TeamLabel>Leadership</TeamLabel>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6 gap-y-1">
                      {leaders.map((person) => (
                        <div key={person.name} className="py-1.5 text-sm">
                          <span className="font-normal text-gray-900">{person.name}</span>
                          {person.title && <span className="text-gray-500"> — {person.title}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {staff.length > 0 && (
                  <>
                    {leaders.length > 0 && <div className="h-5" />}
                    <TeamLabel>Staff</TeamLabel>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-6">
                      {staff.map((person) => (
                        <div key={person.name} className="border-b border-gray-200 py-1.5 text-sm">
                          <span className="text-gray-700">{person.name}</span>
                          {person.title && <span className="text-gray-400"> — {person.title}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </main>

        <aside className="contents xl:sticky xl:top-16 xl:order-2 xl:flex xl:w-80 xl:flex-none xl:flex-col xl:gap-4">
          {openProject ? (
            <div className="order-1">
              <OrgDonateBox
                orgName={org.name}
                project={openProject}
                profile={profile ?? undefined}
                maxDonation={userCharityBalance}
              />
            </div>
          ) : (
            org.donation_url && (
              <div className="order-1 rounded-lg bg-white p-5 shadow">
                <div className="font-medium text-gray-900">Donate to {org.name}</div>
                <p className="mt-1 text-[13px] leading-normal text-gray-500">
                  {org.name} takes donations on its own site.
                </p>
                <a
                  href={org.donation_url}
                  className={`${buttonClass('lg', 'orange')} mt-3.5 w-full`}
                >
                  Donate on their site ↗
                </a>
                <p className="mt-3 truncate text-xs text-gray-400">{hostname(org.donation_url)}</p>
              </div>
            )
          )}
          <OrgFacts org={org} legalLong={legal?.long} />
        </aside>
      </div>
    </div>
  )
}

function TeamLabel(props: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-500">
      {props.children}
    </div>
  )
}

function OrgFacts(props: { org: Org; legalLong?: string }) {
  const { org, legalLong } = props
  const registered = [org.us_state, org.country].filter(Boolean).join(', ')
  const facts: [string, React.ReactNode][] = [
    ['Legal name', org.legal_name],
    ['Type', legalLong],
    ['EIN', org.ein ? `${org.ein.slice(0, 2)}-${org.ein.slice(2)}` : null],
    ['Registered', registered || null],
    ['Founded', org.founded_year],
    [
      'Website',
      org.website && (
        <a href={addHttpToUrl(org.website)} className="text-orange-600 hover:underline">
          {hostname(org.website)}
        </a>
      ),
    ],
  ]
  const known = facts.filter(([, value]) => value)
  return (
    <div className="order-3 rounded-lg bg-white p-5 shadow-sm">
      {known.length > 0 && (
        <>
          <div className="mb-3 text-[13px] font-medium text-gray-900">Organization facts</div>
          <dl className="mb-3.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-gray-100 pb-3 text-[13px]">
            {known.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-gray-500">{label}</dt>
                <dd className="tabular-nums text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <div className="text-xs text-gray-400">
        Is this your org?{' '}
        <a
          href={`${CONTACT}?subject=${encodeURIComponent(`Claiming ${org.name}'s page`)}`}
          className="text-orange-600 hover:underline"
        >
          Claim this page
        </a>
      </div>
    </div>
  )
}
