import { createServerSupabaseClient } from '@/db/supabase-server'
import { listFundSummaries } from '@/db/fund'
import { FundCard } from './fund-card'

export const revalidate = 60
export const metadata = {
  title: 'Funds',
  description: 'Give to a fund on Manifund, and its grantmakers give to projects in public.',
}

export default async function FundsPage() {
  const supabase = await createServerSupabaseClient()
  const funds = await listFundSummaries(supabase)
  return (
    <div className="px-4 pb-24 pt-10 font-light sm:px-6">
      <h1 className="text-[34px] font-medium leading-tight tracking-tight text-gray-900">Funds</h1>
      <p className="mt-2.5 max-w-[60ch] text-pretty text-lg leading-normal text-gray-700">
        Give to a fund, and its grantmakers pass your money on to projects they choose. Every grant
        and application is public on Manifund.
      </p>
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-5">
        {funds.map((summary) => (
          <FundCard key={summary.fund.id} summary={summary} />
        ))}
      </div>
      {funds.length === 0 && <p className="mt-8 text-gray-500">No funds yet.</p>}
      <p className="mt-10 text-[13px] text-gray-500">
        Want to run a fund on Manifund?{' '}
        <a
          href={`mailto:hi@manifund.org?subject=${encodeURIComponent('Running a fund on Manifund')}`}
          className="text-orange-600 hover:underline"
        >
          Email us
        </a>
        .
      </p>
    </div>
  )
}
