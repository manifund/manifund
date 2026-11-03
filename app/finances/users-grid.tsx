'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'
import { DataSheetGrid, textColumn, keyColumn, floatColumn } from 'react-datasheet-grid'
import 'react-datasheet-grid/dist/style.css'

type User = {
  id: string | null
  username?: string
  full_name?: string
  balance: number
}

export default function UsersGrid({ users }: { users: User[] }) {
  // Manifund-Bank has a large negative balance for accounting; ignore it
  const bankBalance = users.find((user) => user.username === 'Manifund-Bank')?.balance ?? 0
  const usersTotal = users.reduce((acc, user) => acc + user.balance, 0) - bankBalance

  const columns = useMemo(
    () => [
      // Link to profile
      {
        component: ({ rowData }) => {
          return (
            <Link
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:underline"
              href={`/${rowData.username}`}
            >
              {rowData.username}
            </Link>
          )
        },
        copyValue: ({ rowData }) => rowData.username,
        title: 'Username',
        width: 200,
        maxWidth: 200,
      },
      {
        ...keyColumn('full_name', textColumn),
        title: 'Full Name',
        width: 200,
        maxWidth: 300,
      },

      {
        ...keyColumn('balance', floatColumn),
        title: 'Balance',
        width: 120,
      },
    ],
    []
  )

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Manifund balance sheet</h1>
      <BalanceSheet />
      <h1 className="my-4 text-2xl font-bold">User balances</h1>
      <div className="text-right text-sm text-gray-500">
        Total (excluding "Manifund Bank" account):{' '}
        {usersTotal.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
      </div>
      <DataSheetGrid value={users} columns={columns} rowHeight={30} height={800} lockRows />
    </div>
  )
}

export function BalanceSheet() {
  const lastUpdated = '2026-11-01'
  const $ = {
    // Stripe Opal + Payments balance (total, incl. pending)
    stripe: 146_981,
    // Mercury Manifund Grants account
    mercury: 2_572_660,
    coinbase: 2_085_444,
    // Current users
    users: -3_967_588,
    // Regranting pot owed + amount assigned to regrantors
    regranting: -2_250_000 + 2_175_000,
    // Withdrawals debited on the platform but not yet sent from Mercury
    // Nov 2026: Jacob Steinhardt $40,250 and Mateusz Bagiński $5,550 awaiting Mercury recipient details;
    // Ali Ahmad Rahemtulla $12,000 and Md Azizul Hakim $1,630 debited Oct 30, wired Nov 2
    pending: -40_250 - 5_550 - 12_000 - 1_630,
    // Received but not tracked on the platform: $900k held for AISTOF
    held_deposit: -900_000,
    // Just Write (Nov 2026) $1,000 commitment deposits taken on Stripe through Nov 1, not on the platform
    just_write: -18_000,
    // Donations for Manifold for Charity
    // 500k initial - donated - David MCF - AmmonLam
    charity: 500000 - 315832 - 186747,
    // Mox: Mercury + Stripe pending
    mox: 216_168 + 31_470,

    mox_fund: 142_300,
    // Committed by Lightcone Commons to Mox, not yet received
    mox_receivable: 813_000,
  }
  const financeRows = [
    { name: 'Stripe Bank', balance: $.stripe },
    { name: 'Mercury', balance: $.mercury },
    { name: 'Coinbase (USDC)', balance: $.coinbase },
    { name: 'Mox balance (Mercury + Stripe)', balance: $.mox },
    { name: 'Mox Fund investments', balance: $.mox_fund },
    { name: 'Pending Lightcone Commons grant to Mox', balance: $.mox_receivable },
    {
      name: 'Total assets',
      balance: $.stripe + $.mercury + $.coinbase + $.mox + $.mox_fund + $.mox_receivable,
    },
    {},
    { name: 'User balances', balance: $.users },
    { name: '2025 regrantor funds, to be allocated', balance: $.regranting },
    { name: 'Pending transfers', balance: $.pending },
    { name: 'Large deposit not on platform', balance: $.held_deposit },
    { name: 'Just Write commitment deposits', balance: $.just_write },
    { name: 'Pending Manifold for Charity donations', balance: $.charity },
    {
      name: 'Total liabilities',
      balance: $.users + $.regranting + $.pending + $.held_deposit + $.just_write + $.charity,
    },
    {},
    {
      name: 'Total net assets',
      balance:
        $.stripe +
        $.mercury +
        $.coinbase +
        $.users +
        $.regranting +
        $.pending +
        $.held_deposit +
        $.just_write +
        $.charity +
        $.mox +
        $.mox_fund +
        $.mox_receivable,
    },
    {},
    { name: '(not included in net calculations)' },
    { name: 'ACX Grants balance', balance: 385 },
    { name: 'Frame Fellowship', balance: 502_180 },
  ]
  // Using a grid to display the finances
  return (
    <>
      <div className="text-right text-sm text-gray-500">
        All values are estimates. Last updated: {lastUpdated}
      </div>
      <DataSheetGrid
        height={800}
        value={financeRows}
        columns={[keyColumn('name', textColumn), keyColumn('balance', floatColumn)]}
        rowHeight={30}
        lockRows
      />
    </>
  )
}
