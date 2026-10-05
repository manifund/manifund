'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { ArrowLongRightIcon } from '@heroicons/react/24/solid'
import { buttonClass } from '@/components/button'
import { RichContent } from '@/components/editor'
import { EmptyContent } from '@/components/empty-content'
import { ProjectsDisplay } from '@/components/projects-display'
import { Tabs } from '@/components/tabs'
import { FullProject } from '@/db/project'
import { Cause, SimpleCause } from '@/db/cause'
import { WrenchIcon } from '@heroicons/react/20/solid'
import { useSearchParams } from 'next/navigation'
import { EditCause } from './edit-cause'
import { Profile, ProfileWithRoles } from '@/db/profile'
import { TxnAndProfiles } from '@/db/txn'
import { DonateSection } from './donate-section'
import { DonationsHistory } from '@/components/donations-history'
import { DividerWithHeader } from '@/components/divider-with-header'
import { Donors } from './donors'
import QuadraticMatch from './qf'
import { BidAndProfile } from '@/db/bid'

export function CauseTabs(props: {
  cause: Cause
  causesList: SimpleCause[]
  projects: FullProject[]
  fund?: Profile
  fundTxns?: TxnAndProfiles[]
  userId?: string
  charityBalance: number
  profiles?: ProfileWithRoles[]
  matchTxns?: TxnAndProfiles[]
  matchBids?: BidAndProfile[]
}) {
  const {
    cause,
    causesList,
    projects,
    fund,
    fundTxns,
    userId,
    charityBalance,
    profiles,
    matchTxns,
    matchBids,
  } = props
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const currentTabId = searchParams.get('tab')
  const visibleProjects = projects.filter((project) => project.stage !== 'hidden')
  const grants = visibleProjects.filter(
    (project) => project.type === 'grant' || project.type === 'dummy'
  )
  const certs = visibleProjects.filter((project) => project.type === 'cert')
  const tabs = [
    {
      name: 'Grants',
      id: 'grants',
      count: grants.length,
      display: (
        <>
          {grants.length === 0 ? (
            <EmptyContent
              icon={<WrenchIcon className="h-10 w-10 text-gray-400" />}
              title={'Coming soon!'}
              subtitle={'No projects here yet.'}
            />
          ) : (
            <ProjectsDisplay projects={grants} causesList={causesList} noFilter={!cause.prize} />
          )}
        </>
      ),
    },
  ]
  if (certs.length > 0) {
    tabs.push({
      name: 'Impact certificates',
      id: 'certs',
      count: certs.length,
      display: (
        <>
          <div>
            <div className="mb-4 font-semibold text-orange-600 hover:underline">
              <Link href="/about/impact-certificates">
                About impact certificates
                <ArrowLongRightIcon className="ml-1 inline h-6 w-6 stroke-2" />
              </Link>
            </div>
            <ProjectsDisplay projects={certs} causesList={causesList} noFilter={!cause.prize} />
          </div>
        </>
      ),
    })
  }

  if (cause.description) {
    tabs.push({
      name: 'About',
      id: 'about',
      count: 0,
      display: (
        <>
          {cause.slug === 'falcon-fund' && (
            <Link
              href="/create?prize=falcon-fund"
              className={clsx(buttonClass('lg', 'orange'), 'mb-6')}
            >
              Apply for funding
            </Link>
          )}
          <RichContent content={cause.description} />
          <EditCause cause={cause} />
        </>
      ),
    })
  }
  if (cause.slug === 'ea-community-choice') {
    if (profiles) {
      tabs.push({
        name: 'Participants',
        id: 'participants',
        count: profiles.length,
        display: <Donors donors={profiles} />,
      })
    }
    if (matchTxns && matchBids) {
      tabs.push({
        name: 'Matching',
        id: 'match',
        count: 0,
        display: <QuadraticMatch projects={projects} matchTxns={matchTxns} matchBids={matchBids} />,
      })
    }
  }
  if (fund && fundTxns) {
    tabs.push({
      name: 'Donate',
      id: 'donate',
      count: 0,
      display: (
        <>
          <span className="text-gray-600">{fund.bio}</span>
          <DonateSection fund={fund} charityBalance={charityBalance} userId={userId} />
          <DividerWithHeader header="Donations history" />
          <DonationsHistory donations={fundTxns} />
        </>
      ),
    })
  }
  return <Tabs tabs={tabs} currentTabId={currentTabId} />
}
