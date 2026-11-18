'use client'

import { CharityData } from '../dummy-data'
import { formatMoney } from '@/utils/formatting'
import { Row } from '@/components/layout/row'
import { Col } from '@/components/layout/col'

interface PriceChartProps {
  charity: CharityData
}

export function PriceChart({ charity }: PriceChartProps) {
  const maxPrice = Math.max(...charity.priceHistory.map(p => p.price))
  const minPrice = Math.min(...charity.priceHistory.map(p => p.price))
  const priceRange = maxPrice - minPrice

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <Col className="gap-4">
        <Row className="justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Price History (30 days)</h2>
          <div className="text-sm text-gray-600">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </Row>

        <div className="relative h-64 bg-gray-50 rounded">
          <svg className="w-full h-full" viewBox="0 0 800 256" preserveAspectRatio="none">
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            <path
              d={generatePricePath(charity.priceHistory, minPrice, priceRange)}
              fill="url(#priceGradient)"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d={generatePriceLinePath(charity.priceHistory, minPrice, priceRange)}
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="absolute top-2 left-2 text-xs text-gray-500">
            {formatMoney(maxPrice)}
          </div>
          <div className="absolute bottom-2 left-2 text-xs text-gray-500">
            {formatMoney(minPrice)}
          </div>
        </div>

        <Row className="justify-between text-sm text-gray-600">
          <span>30 days ago</span>
          <span>Today</span>
        </Row>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <div className="text-sm text-gray-600">Open</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatMoney(charity.priceHistory[0]?.price || 0)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">High</div>
            <div className="text-lg font-semibold text-green-600">
              {formatMoney(maxPrice)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Low</div>
            <div className="text-lg font-semibold text-red-600">
              {formatMoney(minPrice)}
            </div>
          </div>
        </div>
      </Col>
    </div>
  )
}

function generatePricePath(priceHistory: CharityData['priceHistory'], minPrice: number, priceRange: number): string {
  if (priceHistory.length === 0) return ''
  
  const width = 800
  const height = 256
  const stepX = width / (priceHistory.length - 1)
  
  let path = `M 0 ${height}`
  
  priceHistory.forEach((point, index) => {
    const x = index * stepX
    const y = height - ((point.price - minPrice) / priceRange) * height
    if (index === 0) {
      path += ` L ${x} ${y}`
    } else {
      path += ` L ${x} ${y}`
    }
  })
  
  path += ` L ${width} ${height} Z`
  return path
}

function generatePriceLinePath(priceHistory: CharityData['priceHistory'], minPrice: number, priceRange: number): string {
  if (priceHistory.length === 0) return ''
  
  const width = 800
  const height = 256
  const stepX = width / (priceHistory.length - 1)
  
  let path = ''
  
  priceHistory.forEach((point, index) => {
    const x = index * stepX
    const y = height - ((point.price - minPrice) / priceRange) * height
    if (index === 0) {
      path += `M ${x} ${y}`
    } else {
      path += ` L ${x} ${y}`
    }
  })
  
  return path
}