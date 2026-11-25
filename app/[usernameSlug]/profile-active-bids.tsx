'use client'
import { Bid, BidAndProject, deleteBid } from '@/db/bid'
import { Table, TableRow } from '@/components/table'
import { Tag } from '@/components/tags'
import { useSupabase } from '@/db/supabase-provider'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/utils/formatting'
import { Project } from '@/db/project'

export function ActiveBids(props: { bids: BidAndProject[]; isOwnProfile?: boolean }) {
  const { bids, isOwnProfile } = props
  const { supabase } = useSupabase()
  const router = useRouter()
  const bidsDisplay = bids.map((bid) => (
    <TableRow
      key={bid.id}
      title={bid.projects.title}
      subtitle={
        <BidText
          bid={bid}
          projectType={bid.projects.type}
          stage={bid.projects.stage}
          showValuation={isOwnProfile || bid.projects.stage !== 'proposal'}
        />
      }
      href={`/projects/${bid.projects.slug}`}
      deleteFunction={
        isOwnProfile
          ? async () => {
              await deleteBid(supabase, bid.id)
              router.refresh()
            }
          : undefined
      }
    />
  ))
  return (
    <div>
      <h3 className="mb-2 text-lg font-normal tracking-tight text-gray-900">Trade offers</h3>
      <Table>{bidsDisplay}</Table>
    </div>
  )
}

export function BidText(props: {
  bid: Bid
  stage: string
  projectType: Project['type']
  showValuation: boolean
}) {
  const { bid, stage, projectType, showValuation } = props
  switch (stage) {
    case 'proposal':
      if (projectType === 'grant') {
        return (
          <div className="flex items-center">
            <p className="text-sm text-gray-500">
              Offered&nbsp;
              <span className="text-black">{formatMoney(bid.amount)}</span>
            </p>
          </div>
        )
      }
      return (
        <div className="flex items-center">
          <p className="text-sm text-gray-500">
            Offered&nbsp;
            <span className="text-black">{formatMoney(bid.amount)}</span>
            {showValuation && (
              <span>
                &nbsp;@&nbsp;
                <span className="text-black">{formatMoney(bid.valuation)}</span>
                &nbsp;valuation
              </span>
            )}
          </p>
        </div>
      )
    case 'active':
      return (
        <div className="flex items-center text-sm text-gray-500">
          Offered to&nbsp;
          <Tag
            text={bid.type === 'buy' ? 'BUY' : 'SELL'}
            color={bid.type === 'buy' ? 'emerald' : 'rose'}
          />
          <span className="text-black">&nbsp;{formatMoney(bid.amount)}</span>
          <span>
            &nbsp;@&nbsp;
            <span className="text-black">{formatMoney(bid.valuation)}</span>
            &nbsp;valuation
          </span>
        </div>
      )
    default:
      return null
  }
}
