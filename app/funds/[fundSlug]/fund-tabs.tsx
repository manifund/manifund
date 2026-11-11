'use client'
import clsx from 'clsx'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { WrenchIcon } from '@heroicons/react/20/solid'
import { Tab, Tabs } from '@/components/tabs'
import { EmptyContent } from '@/components/empty-content'
import { ProjectsDisplay } from '@/components/projects-display'
import { DonationsHistory } from '@/components/donations-history'
import { buttonClass } from '@/components/button'
import { OutgoingDonationsHistory } from '@/app/[usernameSlug]/profile-donations'
import { Profile } from '@/db/profile'
import { FullTxn, TxnAndProfiles } from '@/db/txn'
import { BidAndProject } from '@/db/bid'
import { FullProject } from '@/db/project'
import { SimpleCause } from '@/db/cause'

export function FundTabs(props: {
  fund: Profile
  grants: FullTxn[]
  pendingOffers: BidAndProject[]
  donations: TxnAndProfiles[]
  applications: FullProject[]
  hasCause: boolean
  // Set while the fund takes applications (its cause is open)
  applySlug?: string
  causesList: SimpleCause[]
}) {
  const { fund, grants, pendingOffers, donations, applications, hasCause, applySlug, causesList } =
    props
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const tabs: Tab[] = [
    {
      name: 'Grants',
      id: 'grants',
      count: grants.length + pendingOffers.length,
      display:
        grants.length + pendingOffers.length === 0 ? (
          <EmptyContent
            icon={<WrenchIcon className="h-10 w-10 text-gray-400" />}
            title="No grants yet"
            subtitle={`Grants ${fund.full_name} makes will be listed here.`}
          />
        ) : (
          <OutgoingDonationsHistory donations={grants} pendingDonateBids={pendingOffers} />
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
              {fund.full_name} isn&apos;t taking applications right now.
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
