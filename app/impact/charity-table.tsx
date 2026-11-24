'use client'

import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { CharityRow } from './charity-row'
import { CharityData } from './dummy-data'

interface CharityTableProps {
  causeArea: string
  charities: CharityData[]
  userId?: string
}

export function CharityTable({
  causeArea,
  charities,
  userId,
}: CharityTableProps) {
  return (
    <Col className="gap-4">
      <h2 className="text-3xl font-thin text-gray-900">{causeArea}</h2>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        {/* Table Header */}
        <div className="border-b border-gray-200 bg-gray-50">
          <Row className="items-center px-6 py-3 text-sm text-gray-600">
            <div className="w-80">Name</div>
            <div className="w-28 text-right">Market Cap</div>
            <div className="w-20 text-right">30d</div>
            <div className="w-20 text-right">Traders</div>
            <div className="w-32 text-center">Trade</div>
          </Row>
        </div>

        {/* Table Body */}
        <div>
          {charities
            .sort((a, b) => b.marketCap - a.marketCap)
            .map((charity) => (
              <CharityRow
                key={charity.ticker}
                charity={charity}
                userId={userId}
              />
            ))}
        </div>
      </div>
    </Col>
  )
}
