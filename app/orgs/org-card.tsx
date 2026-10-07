import Link from 'next/link'
import { Tag } from '@/components/tags'
import { formatCompactMoney } from '@/utils/org-funding'
import { LEGAL_STRUCTURES, type DirectoryOrg } from '@/utils/org-directory'
import { ASSUMED_RATING } from './rating'
import { OrgLogo } from './org-logo'

const SPARK_HEIGHT = 15

export function OrgCard(props: { org: DirectoryOrg }) {
  const { org } = props
  const legal = org.legalStructure ? LEGAL_STRUCTURES[org.legalStructure]?.short : null
  const facts = [legal, org.city].filter(Boolean).join(' · ')
  const peak = Math.max(...org.fundingByYear, 1)
  return (
    <Link
      href={`/orgs/${org.slug}`}
      className="flex flex-col rounded-lg bg-white font-light shadow-sm transition-shadow duration-150 hover:shadow-[0_4px_12px_rgba(17,24,39,0.08)]"
    >
      <div className="flex flex-1 flex-col gap-3 px-5 pb-4 pt-5">
        <div className="flex items-start gap-3.5">
          <OrgLogo org={org} className="h-11 w-11 rounded-lg text-[11px]" />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-normal leading-snug text-gray-900">{org.name}</div>
            {facts && <div className="mt-0.5 text-xs text-gray-400">{facts}</div>}
          </div>
        </div>
        {org.summary && (
          <p className="line-clamp-2 text-pretty text-sm leading-[1.55] text-gray-600">
            {org.summary}
          </p>
        )}
        {(org.cause || org.focus.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {org.cause && <Tag text={org.cause} color="orange" />}
            {org.focus.map((focus) => (
              <Tag key={focus} text={focus} color="gray" />
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-[1.3fr_0.8fr_1fr] border-t border-gray-100">
        <Stat label="Funding" className="px-5">
          {org.funding === null ? (
            <Empty />
          ) : (
            <span className="flex items-end gap-2">
              {formatCompactMoney(org.funding)}
              {/* One bar per year, the current year (so far) lighter. */}
              <span className="flex h-[18px] items-end gap-0.5 pb-[3px]" aria-hidden>
                {org.fundingByYear.map((amount, i) => (
                  <span
                    key={i}
                    className={
                      i === org.fundingByYear.length - 1
                        ? 'w-1 rounded-[1px] bg-orange-300'
                        : 'w-1 rounded-[1px] bg-orange-500'
                    }
                    style={{ height: Math.max(2, (amount / peak) * SPARK_HEIGHT) }}
                  />
                ))}
              </span>
            </span>
          )}
        </Stat>
        <Stat label="Team">{org.staff ?? <Empty />}</Stat>
        <Stat label="Reviews" className="pr-5">
          {org.reviews > 0 ? (
            <>
              {ASSUMED_RATING.toFixed(1)}
              <span className="text-orange-500">★</span>
              <span className="text-[13px] text-gray-400"> · {org.reviews}</span>
            </>
          ) : (
            <Empty />
          )}
        </Stat>
      </div>
    </Link>
  )
}

function Stat(props: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 py-3 ${props.className ?? ''}`}>
      <span className="text-xs text-gray-400">{props.label}</span>
      <span className="font-normal tabular-nums text-gray-900">{props.children}</span>
    </div>
  )
}

const Empty = () => <span className="text-gray-300">–</span>
