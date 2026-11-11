'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { WrenchIcon } from '@heroicons/react/20/solid'
import { Tab, Tabs } from '@/components/tabs'
import { EmptyContent } from '@/components/empty-content'
import { ProjectsDisplay } from '@/components/projects-display'
import { ProjectCard } from '@/components/project-card'
import { formatMoney } from '@/utils/formatting'
import { DonationsHistory } from '@/components/donations-history'
import { buttonClass } from '@/components/button'
import { RichContent } from '@/components/editor'
import { OutgoingDonationsHistory } from '@/app/[usernameSlug]/profile-donations'
import { Profile } from '@/db/profile'
import { FullTxn, TxnAndProfiles } from '@/db/txn'
import { FullProject } from '@/db/project'
import { SimpleCause } from '@/db/cause'

export type GrantAmount = { granted: number; offered: number; latest: string }

// Like ProjectGroup, with a band above each card saying what the fund gave or offered
function GrantCards(props: { projects: FullProject[]; amounts: Record<string, GrantAmount> }) {
  const { projects, amounts } = props
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {projects.map((project) => {
        const { granted, offered } = amounts[project.id]
        return (
          <div
            key={project.id}
            className="flex flex-col [&>:last-child]:flex-1 [&>:last-child]:rounded-tl-none"
          >
            <div className="w-fit bg-orange-100 px-2 py-1 text-sm text-gray-700">
              {granted > 0 && (
                <>
                  <span className="font-semibold">{formatMoney(granted)}</span> granted
                </>
              )}
              {granted > 0 && offered > 0 && ' · '}
              {offered > 0 && (
                <>
                  <span className="font-semibold">{formatMoney(offered)}</span> offered (pending)
                </>
              )}
            </div>
            <ProjectCard project={project} />
          </div>
        )
      })}
    </div>
  )
}

export function FundTabs(props: {
  fund: Profile
  // Projects the fund has given to or has a pending offer on
  grantProjects: FullProject[]
  grantAmounts: Record<string, GrantAmount>
  // Grants to profiles rather than projects
  otherGrants: FullTxn[]
  donations: TxnAndProfiles[]
  applications: FullProject[]
  hasCause: boolean
  // Set while the fund takes applications (its cause is open)
  applySlug?: string
  causesList: SimpleCause[]
}) {
  const {
    fund,
    grantProjects,
    grantAmounts,
    otherGrants,
    donations,
    applications,
    hasCause,
    applySlug,
    causesList,
  } = props
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const grantCount = grantProjects.length + otherGrants.length
  const tabs: Tab[] = [
    {
      name: 'About',
      id: 'about',
      display: fund.long_description ? (
        <RichContent content={fund.long_description} className="px-3 text-sm" />
      ) : (
        <p className="text-sm text-gray-500">No description yet.</p>
      ),
    },
    {
      name: 'Grants',
      id: 'grants',
      count: grantCount,
      display:
        grantCount === 0 ? (
          <EmptyContent
            icon={<WrenchIcon className="h-10 w-10 text-gray-400" />}
            title="No grants yet"
            subtitle={`Grants ${fund.full_name} makes will be listed here.`}
          />
        ) : (
          <>
            {grantProjects.length > 0 && (
              <GrantCards projects={grantProjects} amounts={grantAmounts} />
            )}
            {otherGrants.length > 0 && (
              <div className="mt-6">
                <OutgoingDonationsHistory donations={otherGrants} pendingDonateBids={[]} />
              </div>
            )}
          </>
        ),
    },
  ]
  if (hasCause) {
    tabs.push({
      name: 'Applications',
      id: 'applications',
      count: applications.length,
      display: (
        <>
          {applySlug ? (
            <Link
              href={`/create?prize=${applySlug}`}
              className={clsx(buttonClass('md', 'orange'), 'mb-4 inline-block')}
            >
              Apply for a grant
            </Link>
          ) : (
            <p className="mb-4 text-sm text-gray-500">
              {`${fund.full_name} isn't taking applications right now.`}
            </p>
          )}
          {applications.length > 0 && (
            <ProjectsDisplay projects={applications} causesList={causesList} noFilter />
          )}
        </>
      ),
    })
  }
  tabs.push({
    name: 'Donations',
    id: 'donations',
    count: donations.length,
    display: <DonationsHistory donations={donations} />,
  })
  return <Tabs tabs={tabs} currentTabId={searchParams.get('tab')} />
}
