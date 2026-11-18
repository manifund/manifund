'use client'

import Link from 'next/link'
import { Row } from '@/components/layout/row'
import { formatMoney } from '@/utils/formatting'
import { CharityData } from './dummy-data'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid'
import { clsx } from 'clsx'

interface CharityRowProps {
  charity: CharityData
  userId?: string
}

export function CharityRow({ charity, userId }: CharityRowProps) {
  const isPositive = charity.priceChange >= 0

  return (
    <div className="border-b border-gray-200 transition-colors hover:bg-gray-50">
      <Row className="items-center gap-4 px-6 py-4">
        {/* Icon + Name */}
        <div className="flex w-80 min-w-0 items-center gap-4">
          {charity.iconUrl ? (
            <img src={charity.iconUrl} alt={charity.name} className="h-6 w-6" />
          ) : (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-xs font-bold text-white">
                {charity.ticker.substring(0, 2)}
              </span>
            </div>
          )}
          <Link
            href={`/impact/${charity.ticker}`}
            className="min-w-0 flex-1 hover:underline"
          >
            <div className="truncate text-gray-900">{charity.name}</div>
            <div className="text-sm font-light text-gray-500">
              {charity.ticker}
            </div>
          </Link>
        </div>

        {/* Market Cap */}
        <div className="w-28 text-right">
          <div className="font-medium text-gray-900">
            {formatMoney(charity.marketCap)}
          </div>
        </div>

        {/* Price */}
        {/* <div className="w-24 text-right">
          <div className="text-gray-900">
            {formatMoney(charity.currentPrice)}
          </div>
        </div> */}

        {/* 24h Change */}
        <div className="w-20">
          <Row
            className={clsx(
              'items-center justify-end gap-1 text-sm font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <ArrowUpIcon className="h-3 w-3" />
            ) : (
              <ArrowDownIcon className="h-3 w-3" />
            )}
            {isPositive ? '+' : ''}
            {charity.priceChange.toFixed(1)}%
          </Row>
        </div>

        {/* Traders */}
        <div className="w-20 text-right">
          <div className="text-gray-700">
            {charity.shareholders.toLocaleString()}
          </div>
        </div>

        {/* Trade Buttons */}
        <div className="ml-4 flex gap-2">
          <button
            className="rounded border border-green-600 bg-transparent px-3 py-1.5 text-sm text-green-600 transition-colors hover:bg-green-50"
            onClick={() => alert(`Buy ${charity.ticker} (demo mode)`)}
          >
            Buy
          </button>
          <button
            className="rounded border border-red-600 bg-transparent px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
            onClick={() => alert(`Sell ${charity.ticker} (demo mode)`)}
          >
            Sell
          </button>
        </div>
      </Row>
    </div>
  )
}
