import Link from 'next/link'
import type { FundSummary } from '@/db/fund'
import { formatCompactMoney } from '@/utils/org-funding'
import { fundPath } from '@/utils/funds'
import { FUND_PAGES } from './fund-pages'

export function FundCard(props: { summary: FundSummary }) {
  const { fund, admins, raised, recommended, grantCount, open } = props.summary
  const extras = FUND_PAGES[fund.username] ?? {}
  const cover = extras.cover ?? fund.avatar_url
  const mission = extras.mission ?? fund.bio
  return (
    <Link
      href={fundPath(fund.username)}
      className="group flex flex-col overflow-hidden rounded-xl bg-white font-light shadow-sm transition-shadow duration-150 hover:shadow-[0_4px_12px_rgba(17,24,39,0.08)]"
    >
      <div className="relative aspect-[5/2] bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}
        {open && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-normal text-emerald-700 backdrop-blur-sm">
            Taking applications
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-5 pb-4 pt-4">
        <div className="text-xl font-normal leading-snug text-gray-900">{fund.full_name}</div>
        {mission && (
          <p className="line-clamp-2 text-pretty text-sm leading-[1.55] text-gray-600">{mission}</p>
        )}
        {admins.length > 0 && (
          <p className="mt-auto pt-1 text-xs text-gray-500">
            Run by {admins.map((admin) => admin.full_name).join(' and ')}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-3 border-t border-gray-100">
        {[
          ['Raised', formatCompactMoney(raised)],
          ['Recommended', formatCompactMoney(recommended)],
          ['Grants', `${grantCount}`],
        ].map(([label, value], i) => (
          <div key={label} className="px-5 py-3">
            <dt className="text-xs text-gray-400">{label}</dt>
            <dd className="mt-1 font-normal tabular-nums text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}
