'use client'
import { Stat } from '@/components/stat'
import { Row } from '@/components/layout/row'
import { FullTxn } from '@/db/txn'
import { formatMoney } from '@/utils/formatting'
import { uniq } from 'es-toolkit'
import clsx from 'clsx'
import React, { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Tooltip,
} from 'recharts'

type Period = 'quarterly' | 'monthly' | 'weekly'
const PERIODS: { value: Period; label: string }[] = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]

// Bucket key for a date, sortable as a string
function periodKey(date: Date, period: Period) {
  const year = date.getFullYear()
  if (period === 'quarterly') {
    return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`
  }
  if (period === 'monthly') {
    return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }
  // Weekly: bucket by the Monday that starts the week
  const d = new Date(year, date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// X-axis ticks: show the year at the first bucket of each year, blank otherwise
function tickFormatter(key: string, period: Period) {
  if (period === 'quarterly') {
    return key.endsWith('Q1') ? key.slice(0, 4) : ''
  }
  if (period === 'monthly') {
    return key.endsWith('-01') ? key.slice(0, 4) : ''
  }
  // First week of the year: Monday within the first 7 days of January.
  // Parse the key's parts directly — new Date('yyyy-MM-dd') is UTC midnight,
  // so local getters shift by timezone and break hydration.
  const [, month, day] = key.split('-')
  return month === '01' && parseInt(day) <= 7 ? key.slice(0, 4) : ''
}

function labelFormatter(key: string, period: Period) {
  if (period === 'quarterly') {
    const [year, q] = key.split('-')
    return `${q} ${year}`
  }
  if (period === 'monthly') {
    const [year, month] = key.split('-')
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }
  const [year, month, day] = key.split('-').map((n) => parseInt(n))
  const start = new Date(year, month - 1, day)
  return `Week of ${start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

function PeriodToggle(props: { period: Period; setPeriod: (p: Period) => void }) {
  const { period, setPeriod } = props
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-sm">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setPeriod(value)}
          className={clsx(
            'rounded px-3 py-1 transition-colors',
            period === value
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Stats(props: { txns: FullTxn[] }) {
  const { txns } = props
  const [period, setPeriod] = useState<Period>('monthly')
  const grantDonations = txns.filter(
    (txn) => txn.type === 'project donation' && txn.projects?.type === 'grant'
  )
  const certTradesToCreator = txns.filter(
    (txn) =>
      (txn.type === 'user to amm trade' || txn.type === 'user to user trade') &&
      txn.projects?.creator === txn.to_id &&
      txn.token === 'USD'
  )
  const certTradesFromCreator = txns.filter(
    (txn) =>
      (txn.type === 'user to amm trade' || txn.type === 'user to user trade') &&
      txn.projects?.creator === txn.from_id &&
      txn.token === 'USD'
  )
  const dollarsToGrants = grantDonations.reduce((acc, txn) => acc + txn.amount, 0)
  const dollarsToCerts =
    certTradesToCreator.reduce((acc, txn) => acc + txn.amount, 0) -
    certTradesFromCreator.reduce((acc, txn) => acc + txn.amount, 0)
  const dollarsThroughRegrantors = grantDonations
    .filter((txn) => txn.profiles?.regranter_status && txn.projects?.type === 'grant')
    .reduce((acc, txn) => acc + txn.amount, 0)
  const dollarsToProjects = dollarsToGrants + dollarsToCerts
  const grantsFunded = uniq(grantDonations.map((txn) => txn.project)).length
  const certsFunded = uniq(certTradesToCreator.map((txn) => txn.project)).length
  const numProjectsFunded = grantsFunded + certsFunded
  const grantsToAmounts = Object.fromEntries(grantDonations.map((txn) => [txn.project, 0]))
  const certsToAmounts = Object.fromEntries(certTradesToCreator.map((txn) => [txn.project, 0]))
  grantDonations.forEach((txn) => {
    grantsToAmounts[txn.project as string] += txn.amount
  })
  certTradesToCreator.forEach((txn) => {
    certsToAmounts[txn.project as string] += txn.amount
  })
  certTradesFromCreator.forEach((txn) => {
    certsToAmounts[txn.project as string] -= txn.amount
  })
  const grantSizes = Object.values(grantsToAmounts) as number[]
  const certSizes = Object.values(certsToAmounts) as number[]
  const BUCKETS = [5000, 25000, 100000, 500000]
  const data = BUCKETS.map((threshold, i) => {
    const prevThreshold = i > 0 ? BUCKETS[i - 1] : 0
    return {
      bucket: `<$${threshold >= 1000 ? threshold / 1000 + 'K' : threshold}`,
      grants: grantSizes.filter((size) => size >= prevThreshold && size < threshold).length,
      certs: certSizes.filter((size) => size >= prevThreshold && size < threshold).length,
    }
  })

  const periodData = txns
    .filter((txn) => txn.type === 'project donation')
    .reduce(
      (
        acc: { [key: string]: { amount: number; projects: Set<string>; donors: Set<string> } },
        txn
      ) => {
        const key = periodKey(new Date(txn.created_at), period)
        if (!acc[key]) {
          acc[key] = { amount: 0, projects: new Set(), donors: new Set() }
        }
        acc[key].amount += txn.amount
        acc[key].projects.add(txn.project as string)
        if (typeof txn.from_id === 'string') acc[key].donors.add(txn.from_id)
        return acc
      },
      {}
    )

  const chartData = Object.entries(periodData)
    .sort()
    .map(([key, data]) => ({
      period: key,
      donations: data.amount,
      projectCount: data.projects.size,
      uniqueDonations: data.donors.size,
    }))

  const periodNoun = { quarterly: 'quarter', monthly: 'month', weekly: 'week' }[period]
  const periodAdj = { quarterly: 'Quarterly', monthly: 'Monthly', weekly: 'Weekly' }[period]
  const xAxisProps = {
    dataKey: 'period',
    className: 'text-xs',
    interval: 0 as const,
    tickFormatter: (key: string) => tickFormatter(key, period),
  }

  return (
    <div>
      <Row className="justify-between gap-5 px-5 py-10">
        <Stat
          label="projects funded"
          className="!text-2xl !font-bold sm:!text-3xl"
          value={numProjectsFunded.toString()}
        />
        <Stat
          label="to projects"
          className="!text-2xl !font-bold sm:!text-3xl"
          value={formatMoney(dollarsToProjects)}
        />
        <Stat
          label="through regrantors"
          className="!text-2xl !font-bold sm:!text-3xl"
          value={formatMoney(dollarsThroughRegrantors)}
        />
      </Row>

      <div className="mb-6 flex justify-center">
        <PeriodToggle period={period} setPeriod={setPeriod} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
        {/* Donations over time */}
        <div className="h-96 w-full">
          <h3 className="mb-4 text-center text-gray-700">{periodAdj} donations</h3>
          <ResponsiveContainer width="100%" height="75%">
            <LineChart data={chartData}>
              <XAxis {...xAxisProps} />
              <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="donations"
                name="donations"
                stroke="#ea580c"
                strokeWidth={2}
                animationDuration={300}
              />
              <Tooltip
                formatter={(value: number) => [`$${(value / 1000).toFixed(1)}K donated`]}
                labelFormatter={(key) => labelFormatter(key, period)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Projects funded over time */}
        <div className="h-96 w-full">
          <h3 className="mb-4 text-center text-gray-700">Projects funded per {periodNoun}</h3>
          <ResponsiveContainer width="100%" height="75%">
            <LineChart data={chartData}>
              <XAxis {...xAxisProps} />
              <YAxis tickFormatter={(value) => Math.round(value).toString()} />
              <Legend />
              <Line
                type="monotone"
                dataKey="projectCount"
                name="projects funded"
                stroke="#fdba74"
                strokeWidth={2}
                animationDuration={300}
              />
              <Tooltip
                formatter={(value: number) => [`${value} projects funded`]}
                labelFormatter={(key) => labelFormatter(key, period)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Unique donors over time */}
        <div className="h-96 w-full">
          <h3 className="mb-4 text-center text-gray-700">Unique donations per {periodNoun}</h3>
          <ResponsiveContainer width="100%" height="75%">
            <LineChart data={chartData}>
              <XAxis {...xAxisProps} />
              <YAxis tickFormatter={(value) => Math.round(value).toString()} />
              <Legend />
              <Line
                type="monotone"
                dataKey="uniqueDonations"
                name="unique donations"
                stroke="#a3e635"
                strokeWidth={2}
                animationDuration={300}
              />
              <Tooltip
                formatter={(value: number) => [`${value} unique donations`]}
                labelFormatter={(key) => labelFormatter(key, period)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Grant sizes */}
        <div className="h-96 w-full">
          <h3 className="mb-4 text-center text-gray-700">Grant sizes</h3>
          <ResponsiveContainer width="100%" height="75%">
            <BarChart width={500} height={300} data={data}>
              <XAxis dataKey="bucket" className="text-xs" />
              <YAxis />
              <Legend iconType="circle" />
              <Tooltip
                formatter={(value: number, name: string) => [`${value} ${name.replace(/s$/, 's')}`]}
                labelFormatter={(label) => `Projects ${label}`}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="grants" fill="#ea580c" radius={[5, 5, 0, 0]} />
              <Bar dataKey="certs" fill="#fdba74" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
