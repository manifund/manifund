import { Row } from '@/components/layout/row'
import { Table } from '@/components/table'
import { Tag } from '@/components/tags'
import { Tooltip } from '@/components/tooltip'
import { BidAndProject } from '@/db/bid'
import { FullTxn } from '@/db/txn'
import { HeartIcon, UserIcon, WrenchIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import { RelativeTime } from '@/components/relative-time'
import { orderBy } from 'es-toolkit'
import Link from 'next/link'

export function OutgoingDonationsHistory(props: {
  donations: FullTxn[]
  pendingDonateBids: BidAndProject[]
}) {
  const { donations, pendingDonateBids } = props
  const sortedDonations = orderBy(donations, ['created_at'], ['desc'])
  const sortedBids = orderBy(pendingDonateBids, ['created_at'], ['desc'])
  const donationsDisplay = sortedDonations.map((donation) => {
    const type = donation.project
      ? 'project'
      : donation.profiles?.type === 'individual'
        ? 'regranter'
        : donation.profiles?.type === 'fund'
          ? 'fund'
          : 'charity'
    const name =
      (type === 'project' ? donation.projects?.title : donation.profiles?.full_name) ?? ''
    const url =
      type === 'project'
        ? `/projects/${donation.projects?.slug}`
        : donation.profiles?.type === 'individual'
          ? `/${donation.profiles?.username}`
          : `/charity/${donation.profiles?.username}`
    return (
      <DonationRow
        key={donation.id}
        type={type}
        name={name}
        url={url}
        amount={donation.amount}
        date={<RelativeTime date={donation.created_at} />}
      />
    )
  })
  const pendingGrantDisplay = sortedBids.map((bid) => {
    return (
      <DonationRow
        key={bid.id}
        type="project"
        name={bid.projects.title}
        url={`/projects/${bid.projects.slug}?tab=bids`}
        amount={bid.amount}
      />
    )
  })
  return (
    <div>
      <h1 className="mb-2 text-xl font-medium sm:text-2xl">Outgoing donations</h1>
      <div className="overflow-hidden rounded-md bg-white shadow">
        <Table>
          {pendingGrantDisplay}
          {donationsDisplay}
        </Table>
      </div>
    </div>
  )
}

function DonationRow(props: {
  type: 'project' | 'regranter' | 'fund' | 'charity'
  name: string
  url: string
  amount: number
  date?: React.ReactNode
}) {
  const { type, name, url, amount, date } = props
  return (
    <Link href={url} className="group grid w-full grid-cols-4">
      <Row className="col-span-2 items-center gap-5 p-3">
        {type === 'project' && (
          <Tooltip text="project">
            <WrenchIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />
          </Tooltip>
        )}
        {type === 'regranter' && (
          <Tooltip text="regranter">
            <UserIcon className="h-5 w-5 flex-shrink-0 text-orange-500" />
          </Tooltip>
        )}
        {type === 'fund' && (
          <Tooltip text="charity">
            <UserGroupIcon className="h-5 w-5 flex-shrink-0 text-emerald-500" />
          </Tooltip>
        )}
        {type === 'charity' && (
          <Tooltip text="charity">
            <HeartIcon className="h-5 w-5 flex-shrink-0 text-rose-500" />
          </Tooltip>
        )}
        <span className="truncate text-base font-medium text-gray-900 group-hover:underline">
          {name}
        </span>
      </Row>
      <div className="px-3 py-3 text-right sm:px-0">${amount}</div>
      <div className="hidden justify-end p-3 text-right text-sm text-gray-500 sm:flex">
        {date ? date : <Tag text="PENDING" color="gray" />}
      </div>
    </Link>
  )
}
