'use client'
import Link from 'next/link'
import clsx from 'clsx'
import { RelativeTime } from '@/components/relative-time'
import { formatMoneyPrecise } from '@/utils/formatting'
import { loadMoreDonations, loadMoreTxns } from '../actions'
import { ShowMore, usePaged } from '../show-more'
import type { DonationRow, Page, TxnRow } from '../profile-data'

const KIND_LABEL: Record<DonationRow['kind'], string> = {
  project: 'Project',
  person: 'Regrantor',
  fund: 'Fund',
  charity: 'Charity',
}

export function DonationList(props: {
  profileId: string
  first: Page<DonationRow>
  total: number
}) {
  const { profileId, first, total } = props
  const { items, hasMore, more, pending, error } = usePaged(first, (offset) =>
    loadMoreDonations(profileId, offset)
  )
  return (
    <>
      <ul className="divide-y divide-gray-100 rounded-lg bg-white shadow-sm">
        {items.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group flex items-center gap-3 px-5 py-3 focus:outline-none focus-visible:bg-orange-50"
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-normal text-gray-900 group-hover:underline">
                {row.name}
              </span>
              {row.kind !== 'project' && (
                <span className="hidden flex-none text-[13px] text-gray-500 sm:inline">
                  {KIND_LABEL[row.kind]}
                </span>
              )}
              {row.date ? (
                <span className="hidden flex-none whitespace-nowrap text-right text-[13px] text-gray-500 sm:inline">
                  <RelativeTime date={row.date} />
                </span>
              ) : (
                <span className="flex-none rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  Offer pending
                </span>
              )}
              <span className="w-20 flex-none text-right text-[15px] font-normal tabular-nums text-gray-900">
                {formatMoneyPrecise(row.amount)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <ShowMore
          shown={items.length}
          total={total}
          onClick={more}
          pending={pending}
          error={error}
        />
      )}
    </>
  )
}

export function TxnTable(props: { profileId: string; first: Page<TxnRow>; total: number }) {
  const { profileId, first, total } = props
  const { items, hasMore, more, pending, error } = usePaged(first, (offset) =>
    loadMoreTxns(profileId, offset)
  )
  return (
    <>
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-gray-100 text-[13px] text-gray-500">
            <tr>
              <th className="px-5 py-3 font-normal">For</th>
              <th className="hidden w-40 px-3 py-3 font-normal sm:table-cell">Type</th>
              <th className="w-32 px-3 py-3 font-normal">When</th>
              <th className="w-28 px-5 py-3 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((txn) => (
              <tr key={txn.id}>
                <td className="truncate px-5 py-2.5 text-gray-900">
                  {txn.href ? (
                    <Link href={txn.href} className="hover:underline">
                      {txn.label}
                    </Link>
                  ) : (
                    txn.label
                  )}
                </td>
                <td className="hidden truncate px-3 py-2.5 text-gray-500 sm:table-cell">
                  {txn.type}
                </td>
                <td className="truncate px-3 py-2.5 text-gray-500">
                  <RelativeTime date={txn.date} />
                </td>
                <td
                  className={clsx(
                    'whitespace-nowrap px-5 py-2.5 text-right tabular-nums',
                    txn.direction === 'in' ? 'text-emerald-700' : 'text-gray-900'
                  )}
                >
                  {txn.direction === 'in' ? '+' : txn.direction === 'out' ? '−' : ''}
                  {formatMoneyPrecise(txn.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <ShowMore
          shown={items.length}
          total={total}
          onClick={more}
          pending={pending}
          error={error}
        />
      )}
    </>
  )
}
