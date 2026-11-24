import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { Col } from '@/components/layout/col'
import { notFound } from 'next/navigation'
import { DUMMY_CHARITY_DATA, CharityData } from '../dummy-data'
import { CharityHeader } from './charity-header'
import { PriceChart } from './price-chart'
import { TradingPanel } from './trading-panel'
import { CharityTabs } from './charity-tabs'

interface CharityPageProps {
  params: {
    ticker: string
  }
}

export default async function CharityPage({ params }: CharityPageProps) {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)

  const charity = findCharityByTicker(params.ticker.toUpperCase())
  
  if (!charity) {
    notFound()
  }

  return (
    <Col className="gap-6 px-3 py-5 sm:px-6">
      <CharityHeader charity={charity} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartSkeleton />}>
            <PriceChart charity={charity} />
          </Suspense>
        </div>
        
        <div>
          <Suspense fallback={<TradingPanelSkeleton />}>
            <TradingPanel charity={charity} userId={user?.id} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<TabsSkeleton />}>
        <CharityTabs charity={charity} userId={user?.id} />
      </Suspense>
    </Col>
  )
}

function findCharityByTicker(ticker: string): CharityData | null {
  for (const causeArea of Object.values(DUMMY_CHARITY_DATA)) {
    const charity = causeArea.find(c => c.ticker === ticker)
    if (charity) return charity
  }
  return null
}

function ChartSkeleton() {
  return <div className="h-80 bg-gray-200 animate-pulse rounded-lg" />
}

function TradingPanelSkeleton() {
  return <div className="h-96 bg-gray-200 animate-pulse rounded-lg" />
}

function TabsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-12 bg-gray-200 rounded mb-4" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  )
}