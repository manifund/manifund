'use client'
import { formatMoney } from '@/utils/formatting'
import type { Investment } from './profile-data'
import { Table, TableRow } from '@/components/table'

export function Investments(props: { investments: Investment[] }) {
  const { investments } = props
  const investmentsDisplay = investments
    .filter((investment) => investment.numShares !== 0 && investment.project)
    .map((investment) => {
      const priceText = (
        <span className="flex items-center text-sm font-normal text-gray-500">
          bought&nbsp;
          <span className="text-black">{formatMoney(-investment.priceUsd)}</span>
          &nbsp;@&nbsp;
          <span className="text-black">
            {formatMoney((-investment.priceUsd * 10000000) / investment.numShares)}
          </span>
          &nbsp;valuation
        </span>
      )
      return investment.project ? (
        <TableRow
          title={investment.project.title}
          subtitle={priceText}
          href={`/projects/${investment.project.slug}/?tab=shareholders`}
          key={investment.project.id}
        />
      ) : null
    })
  return (
    <div>
      <h3 className="mb-2 text-lg font-normal tracking-tight text-gray-900">Investments</h3>
      <Table>{investmentsDisplay}</Table>
    </div>
  )
}
