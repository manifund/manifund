'use client'
import React from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import { Select } from './select'

// TODO: Consider rewriting the tab navigation pattern to use Parallel Routes:
// https://nextjs.org/docs/app/building-your-application/routing/parallel-routes#tab-groups

export type Tab = {
  name: string
  id: string
  count?: number
  display: React.JSX.Element
}
export function Tabs(props: { tabs: Tab[]; currentTabId?: string | null }) {
  const { tabs } = props
  // Default currentTabId to the first tab, if not provided
  let currentTabId = props.currentTabId ?? tabs[0].id
  // If currentTabId is not in tabs, use the first tab
  // This can happen if there's a modal with tabs, over a page with tabs
  if (!tabs.some((tab) => tab.id === currentTabId)) {
    currentTabId = tabs[0].id
  }

  if (tabs.length === 0) return null
  return (
    <div>
      <div className="border-b border-gray-200 py-4 sm:hidden">
        <Select
          selected={(tabs.find((tab) => tab.id === currentTabId) ?? tabs[0]).name}
          onSelect={(event) => switchTab(tabs.find((tab) => tab.name === event)?.id ?? tabs[0].id)}
          options={tabs.map((tab) => tab.name)}
          label="Tab:"
        />
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <SingleTab tab={tab} isCurrent={tab.id === currentTabId} key={tab.id} />
            ))}
          </nav>
        </div>
      </div>
      <div className="py-6">{tabs.filter((tab) => tab.id === currentTabId)[0].display}</div>
    </div>
  )
}

// Every tab panel is already rendered client-side, so navigating through the
// router just re-renders the whole page on the server to show content the
// browser already has. pushState updates useSearchParams without that trip.
function switchTab(id: string) {
  window.history.pushState(null, '', `?tab=${id}`)
}

function SingleTab(props: { tab: Tab; isCurrent: boolean }) {
  const { tab, isCurrent } = props
  return (
    <Link
      key={tab.id}
      href={`?tab=${tab.id}`}
      prefetch={false}
      scroll={false}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        switchTab(tab.id)
      }}
      className={clsx(
        isCurrent
          ? 'border-orange-500 text-orange-600'
          : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700',
        'flex whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium'
      )}
      aria-current={isCurrent ? 'page' : undefined}
    >
      {tab.name}
      {tab.count && tab.count > 0 ? (
        <span
          className={clsx(
            isCurrent ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-900',
            'ml-3 hidden rounded-full px-2.5 py-0.5 text-xs font-medium md:inline-block'
          )}
        >
          {tab.count}
        </span>
      ) : null}
    </Link>
  )
}
