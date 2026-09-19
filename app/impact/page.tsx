import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { Col } from '@/components/layout/col'
import { ImpactExchangeHeader } from './impact-exchange-header'
import { CharityTable } from './charity-table'
import { DUMMY_CHARITY_DATA } from './dummy-data'

export const metadata = {
  title: 'Impact Exchange',
  description:
    'Trade impact certificates from leading charities in AI safety and EA spaces',
}

export default async function ImpactExchange() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)

  const causeAreas = [
    'Technical AI Safety',
    'AI Governance',
    'EA Community',
    'Animal Welfare',
  ]

  return (
    <Col className="gap-8 px-3 py-5 sm:px-6">
      <ImpactExchangeHeader />

      {causeAreas.map((causeArea) => {
        const charities = DUMMY_CHARITY_DATA[causeArea] || []

        return (
          <Suspense key={causeArea} fallback={<CauseSectionSkeleton />}>
            <CharityTable
              causeArea={causeArea}
              charities={charities}
              userId={user?.id}
            />
          </Suspense>
        )
      })}
    </Col>
  )
}

function CauseSectionSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-8 w-64 rounded bg-gray-200" />
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="h-12 border-b bg-gray-100" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 border-b bg-gray-50" />
        ))}
      </div>
    </div>
  )
}
