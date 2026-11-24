'use client'

import Link from 'next/link'
import { Card } from '@/components/layout/card'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { formatMoney } from '@/utils/formatting'
import { CharityData } from './dummy-data'
import { 
  ArrowUpIcon, 
  ArrowDownIcon,
  ChartBarIcon,
  UsersIcon
} from '@heroicons/react/20/solid'
import { clsx } from 'clsx'

interface CharityCardProps {
  charity: CharityData
  userId?: string
}

export function CharityCard({ charity, userId }: CharityCardProps) {
  const isPositive = charity.priceChange >= 0
  
  return (
    <Card className="px-4 py-4 hover:shadow-md transition-shadow">
      <Col className="h-full gap-3">
        <Row className="items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {charity.ticker.substring(0, 2)}
              </span>
            </div>
            <Col className="gap-0">
              <span className="font-bold text-gray-900">{charity.ticker}</span>
              <span className="text-xs text-gray-500">{charity.name}</span>
            </Col>
          </div>
          <Row className={clsx(
            'items-center gap-1 px-2 py-1 rounded text-xs font-medium',
            isPositive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          )}>
            {isPositive ? (
              <ArrowUpIcon className="h-3 w-3" />
            ) : (
              <ArrowDownIcon className="h-3 w-3" />
            )}
            {isPositive ? '+' : ''}{charity.priceChange.toFixed(1)}%
          </Row>
        </Row>

        <Link
          href={`/impact/${charity.ticker.toLowerCase()}`}
          className="group flex h-full flex-col gap-2 hover:cursor-pointer"
        >
          <Col className="gap-1">
            <div className="text-2xl font-bold text-gray-900 group-hover:underline">
              {formatMoney(charity.currentPrice)}
            </div>
            <div className="text-sm text-gray-600">
              per impact certificate
            </div>
          </Col>

          <div className="h-16 bg-gradient-to-r from-blue-50 to-purple-50 rounded flex items-center justify-center">
            <ChartBarIcon className="h-8 w-8 text-gray-400" />
          </div>
        </Link>

        <Row className="justify-between text-xs text-gray-500 pt-2 border-t">
          <div className="flex items-center gap-1">
            <UsersIcon className="h-3 w-3" />
            <span>{charity.shareholders} holders</span>
          </div>
          <div>
            Vol: {formatMoney(charity.volume24h)}
          </div>
        </Row>

        <Row className="gap-2 pt-2">
          <button className="flex-1 bg-green-600 text-white text-sm font-medium px-3 py-2 rounded hover:bg-green-700 transition-colors">
            Buy
          </button>
          <button className="flex-1 bg-red-600 text-white text-sm font-medium px-3 py-2 rounded hover:bg-red-700 transition-colors">
            Sell
          </button>
        </Row>
      </Col>
    </Card>
  )
}