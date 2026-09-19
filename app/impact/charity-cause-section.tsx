'use client'

import { Col } from '@/components/layout/col'
import { CharityCard } from './charity-card'
import { CharityData } from './dummy-data'

interface CharityCauseSectionProps {
  causeArea: string
  charities: CharityData[]
  userId?: string
}

export function CharityCauseSection({ causeArea, charities, userId }: CharityCauseSectionProps) {
  return (
    <Col className="gap-4">
      <h2 className="text-2xl font-bold text-gray-900">{causeArea}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {charities.map((charity) => (
          <CharityCard 
            key={charity.ticker}
            charity={charity}
            userId={userId}
          />
        ))}
      </div>
    </Col>
  )
}