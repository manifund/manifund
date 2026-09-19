'use client'

import { Row } from '@/components/layout/row'
import { Col } from '@/components/layout/col'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'

export function ImpactExchangeHeader() {
  return (
    <Col className="gap-6">
      <div className="text-center">
        <h1 className="font-josefin text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          MIX: Manifund Impact eXchange
        </h1>
        <p className="mt-4 text-lg font-light text-gray-500">
          Trade impact certificates on leading orgs in AI safety and EA
        </p>
      </div>

      <Row className="justify-center gap-8 rounded-lg border bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-gray-900">Market Open</span>
        </div>
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5 text-blue-500" />
          <span className="text-sm text-gray-600">$2.4M Total Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="h-5 w-5 text-purple-500" />
          <span className="text-sm text-gray-600">84 Active Securities</span>
        </div>
      </Row>
    </Col>
  )
}
