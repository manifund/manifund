'use client'

import { useState } from 'react'
import { CharityData } from '../dummy-data'
import { formatMoney } from '@/utils/formatting'
import { Col } from '@/components/layout/col'
import { Row } from '@/components/layout/row'
import { clsx } from 'clsx'

interface TradingPanelProps {
  charity: CharityData
  userId?: string
}

export function TradingPanel({ charity, userId }: TradingPanelProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')

  const isLoggedIn = Boolean(userId)
  const totalValue = amount ? parseFloat(amount) * charity.currentPrice : 0

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <Col className="gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Trade {charity.ticker}</h2>

        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab('buy')}
            className={clsx(
              'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors',
              activeTab === 'buy'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={clsx(
              'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors',
              activeTab === 'sell'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Sell
          </button>
        </div>

        <Col className="gap-3">
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setOrderType('market')}
              className={clsx(
                'flex-1 py-1 px-3 text-xs font-medium rounded transition-colors',
                orderType === 'market'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              )}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType('limit')}
              className={clsx(
                'flex-1 py-1 px-3 text-xs font-medium rounded transition-colors',
                orderType === 'limit'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              )}
            >
              Limit
            </button>
          </div>

          {orderType === 'limit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limit Price
              </label>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={charity.currentPrice.toFixed(2)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shares
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Row className="justify-between text-sm">
            <span className="text-gray-600">Current Price:</span>
            <span className="font-medium">{formatMoney(charity.currentPrice)}</span>
          </Row>

          {totalValue > 0 && (
            <Row className="justify-between text-sm">
              <span className="text-gray-600">Total Value:</span>
              <span className="font-medium">{formatMoney(totalValue)}</span>
            </Row>
          )}
        </Col>

        {isLoggedIn ? (
          <button
            className={clsx(
              'w-full py-3 px-4 font-medium rounded-md transition-colors',
              activeTab === 'buy'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            )}
            onClick={() => {
              alert(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} order placed (demo mode)`)
            }}
          >
            Place {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Order
          </button>
        ) : (
          <button
            className="w-full py-3 px-4 bg-gray-300 text-gray-600 font-medium rounded-md cursor-not-allowed"
            disabled
          >
            Log in to Trade
          </button>
        )}

        <div className="pt-4 border-t">
          <h3 className="font-medium text-gray-900 mb-2">Your Holdings</h3>
          {isLoggedIn ? (
            <Col className="gap-2 text-sm">
              <Row className="justify-between">
                <span className="text-gray-600">Shares:</span>
                <span>0</span>
              </Row>
              <Row className="justify-between">
                <span className="text-gray-600">Value:</span>
                <span>{formatMoney(0)}</span>
              </Row>
              <Row className="justify-between">
                <span className="text-gray-600">P&L:</span>
                <span className="text-gray-600">{formatMoney(0)}</span>
              </Row>
            </Col>
          ) : (
            <p className="text-sm text-gray-600">Log in to view your holdings</p>
          )}
        </div>
      </Col>
    </div>
  )
}