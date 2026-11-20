'use client'

import { useState, useMemo, memo } from 'react'
import clsx from 'clsx'
import { supabaseProfileRowUrl } from '@/utils/supabase-admin-url'
import { calculateDonorFee } from '@/utils/math'
import type { PayUserProps } from '@/pages/api/pay-user'

type UserRow = {
  id: string
  email: string
  username: string | null
  accredited: boolean
  balance: number
  lifetimeDeposits: number
}

export function UserTable(props: { users: UserRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return props.users
    const q = search.toLowerCase()
    return props.users.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.username?.toLowerCase().includes(q) ?? false)
    )
  }, [search, props.users])

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <input
          type="text"
          className="mb-2 w-64 rounded border border-gray-300 px-2 py-1 text-xs placeholder-gray-400 focus:border-orange-500 focus:outline-none"
          placeholder="Search email or username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <table className="mx-auto min-w-[1024px] max-w-5xl table-fixed text-left text-xs">
        <colgroup>
          <col style={{ width: 20 }} />
          <col style={{ width: 300 }} />
          <col style={{ width: 210 }} />
          <col style={{ width: 28 }} />
          <col style={{ width: 460 }} />
        </colgroup>
        <thead className="border-b text-[10px] uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="py-0.5"></th>
            <th className="py-0.5">Email</th>
            <th className="py-0.5">Username</th>
            <th className="py-0.5">Acc</th>
            <th className="py-0.5">Balance / Pay</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user, i) => (
            <MemoRow key={user.id} user={user} odd={i % 2 === 1} />
          ))}
        </tbody>
      </table>
    </>
  )
}

const MemoRow = memo(function UserRowComponent({ user, odd }: { user: UserRow; odd: boolean }) {
  return (
    <tr className={odd ? 'bg-zinc-100 hover:bg-zinc-200/60' : 'hover:bg-zinc-100/60'}>
      <td className="py-px">
        <a
          href={supabaseProfileRowUrl(user.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="inline h-2.5 w-2.5"
          >
            <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375 7.444 2.25 12 2.25s8.25 1.847 8.25 4.125z" />
            <path d="M3.75 9.75c0 2.278 3.694 4.125 8.25 4.125s8.25-1.847 8.25-4.125" />
            <path d="M3.75 13.125c0 2.278 3.694 4.125 8.25 4.125s8.25-1.847 8.25-4.125" />
            <path d="M3.75 16.5c0 2.278 3.694 4.125 8.25 4.125s8.25-1.847 8.25-4.125" />
          </svg>
        </a>
      </td>
      <td className="truncate py-px pr-2 text-zinc-500">{user.email}</td>
      <td className="truncate py-px pr-2">
        {user.username ? (
          <a href={`/${user.username}`} className="text-orange-600 hover:underline">
            {user.username}
          </a>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>
      <td className="py-px">
        <AccreditedToggle userId={user.id} accredited={user.accredited} />
      </td>
      <td className="py-px">
        <PayControls
          userId={user.id}
          balance={user.balance}
          lifetimeDeposits={user.lifetimeDeposits}
        />
      </td>
    </tr>
  )
})

function AccreditedToggle({ userId, accredited }: { userId: string; accredited: boolean }) {
  const [value, setValue] = useState(accredited)
  return (
    <button
      className="cursor-pointer text-sm leading-none"
      onClick={async () => {
        const next = !value
        setValue(next)
        await fetch('/api/verify-investor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, accredited: next }),
        })
      }}
    >
      {value ? '✅' : '❌'}
    </button>
  )
}

function PayControls({
  userId,
  balance,
  lifetimeDeposits,
}: {
  userId: string
  balance: number
  lifetimeDeposits: number
}) {
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState(false)
  // null = use the suggested fee; cleared whenever the amount changes
  const [feeInput, setFeeInput] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const parsed = parseFloat(amount)
  const hasAmount = !isNaN(parsed) && parsed !== 0
  const isDeposit = hasAmount && parsed > 0
  const suggestedFee = isDeposit ? calculateDonorFee(lifetimeDeposits, parsed) : 0
  const feeText = feeInput ?? (suggestedFee ? suggestedFee.toString() : '')
  const fee = isDeposit ? Number(feeText) || 0 : 0
  const feeInvalid = fee < 0 || (fee > 0 && fee >= parsed)

  return (
    <div className="flex items-center gap-1.5">
      <button
        className="w-14 cursor-pointer text-right font-mono text-xs tabular-nums hover:text-orange-600"
        onClick={() => {
          setAmount((-balance).toString())
          setFeeInput(null)
        }}
        title="Click to prefill withdrawal"
      >
        {Number(balance.toFixed(2))}
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-xs tabular-nums focus:border-orange-500 focus:outline-none"
        placeholder="0"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value.replace(/[^\d.\-]/g, ''))
          setFeeInput(null)
        }}
      />
      <label className="flex items-center gap-0.5">
        <input
          type="checkbox"
          className="h-3 w-3 cursor-pointer rounded border-gray-300 text-orange-600"
          checked={receipt}
          onChange={(e) => setReceipt(e.target.checked)}
        />
        <span className="text-[10px] text-gray-500">Receipt</span>
      </label>
      {isDeposit && (
        <label
          className="flex items-center gap-0.5"
          title={`Lifetime deposits so far: $${Math.round(lifetimeDeposits).toLocaleString()}`}
        >
          <span className="text-[10px] text-gray-500">Fee</span>
          <input
            type="text"
            inputMode="numeric"
            className={clsx(
              'w-14 rounded border px-1.5 py-0.5 text-xs tabular-nums focus:outline-none',
              feeInvalid
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-orange-500'
            )}
            placeholder="0"
            value={feeText}
            onChange={(e) => setFeeInput(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
      )}
      <button
        className="rounded bg-orange-500 px-1.5 py-0.5 text-xs font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-200"
        disabled={!hasAmount || feeInvalid || loading}
        onClick={async () => {
          setLoading(true)
          setError('')
          const res = await fetch('/api/pay-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              amount: parsed,
              sendDonationReceipt: receipt,
              fee,
            } satisfies PayUserProps),
          })
          setLoading(false)
          if (!res.ok) {
            setError((await res.json().catch(() => null))?.error ?? 'Failed')
            return
          }
          setAmount('')
          setFeeInput(null)
          window.location.reload()
        }}
      >
        {loading ? '...' : 'Add'}
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
