'use client'
import { FullProject } from '@/db/project'
import { CheckIcon, ChevronUpDownIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Listbox, Popover, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { getAmountRaised, getProjectValuation } from '@/utils/math'
import clsx from 'clsx'
import { ProjectGroup } from '@/components/project-group'
import { Row } from './layout/row'
import { MiniCause, SimpleCause } from '@/db/cause'
import { CauseTag } from './tags'
import { Col } from './layout/col'
import { SearchBar } from './input'
import { searchInAny } from '@/utils/parse'
import { LoadMoreUntilNotVisible } from './widgets/visibility-observer'
import { sortBy } from 'es-toolkit'
import { countVotes, hotScore } from '@/utils/sort'
import { Checkbox } from './input'
import { isSlopProject } from '@/utils/slop'

type SortOption =
  | 'votes'
  | 'funding'
  | 'newest'
  | 'hot'
  | 'closing soon'

const DEFAULT_SORT_OPTIONS = ['hot', 'newest', 'closing soon', 'votes', 'funding'] as SortOption[]

export function ProjectsDisplay(props: {
  projects: FullProject[]
  causesList: SimpleCause[]
  defaultSort?: SortOption
  hideRound?: boolean
  noFilter?: boolean
}) {
  const { projects, defaultSort, causesList, noFilter } = props
  const prices = getPrices(projects)
  const [sortBy, setSortBy] = useState<SortOption>(defaultSort ?? 'hot')
  const [includedCauses, setIncludedCauses] = useState<MiniCause[]>([])
  const [search, setSearch] = useState<string>('')
  const [hideSlop, setHideSlop] = useState<boolean>(true)
  const slopCount = projects.filter(isSlopProject).length
  const anySlop = slopCount > 0
  const visibleProjects = hideSlop
    ? projects.filter((project) => !isSlopProject(project))
    : projects
  const filteredProjects = filterProjects(visibleProjects, includedCauses)
  const sortedProjects = sortProjects(noFilter ? visibleProjects : filteredProjects, sortBy)
  const CLIENT_PAGE_SIZE = 20
  const [numToShow, setNumToShow] = useState<number>(CLIENT_PAGE_SIZE)
  const selectedProjects = sortedProjects
    .filter((project) => {
      return searchInAny(
        search,
        project.title,
        project.blurb ?? '',
        project.profiles.full_name,
        project.profiles.username,
        project.project_transfers?.[0]?.recipient_name ?? ''
      )
    })
    .slice(0, numToShow)

  const fundableProjects = selectedProjects.filter(
    (project) => project.stage == 'proposal' || project.stage == 'active'
  )
  const completeProjects = selectedProjects.filter((project) => project.stage == 'complete')
  const unfundedProjects = selectedProjects.filter((project) => project.stage == 'not funded')

  const filterableCauses = noFilter ? [] : causesList.filter((c) => !c.prize)
  const showFilters = filterableCauses.length > 0 || anySlop

  return (
    <Col className="gap-2">
      <Row className="items-stretch gap-2">
        <SearchBar
          search={search}
          setSearch={setSearch}
          className="min-w-0 flex-1"
          placeholder={`Search ${sortedProjects.length} projects`}
        />
        <SortSelect sortBy={sortBy} setSortBy={setSortBy} />
        {showFilters && (
          <FilterPopover
            causes={filterableCauses}
            includedCauses={includedCauses}
            setIncludedCauses={setIncludedCauses}
            slopCount={anySlop ? slopCount : 0}
            hideSlop={hideSlop}
            setHideSlop={setHideSlop}
          />
        )}
      </Row>
      {includedCauses.length > 0 && (
        <Row className="flex-wrap items-center gap-1.5">
          {includedCauses.map((cause) => (
            <button
              key={cause.slug}
              onClick={() => setIncludedCauses(includedCauses.filter((c) => c.slug !== cause.slug))}
              className="group flex items-center gap-0.5 whitespace-nowrap rounded-full bg-orange-100 py-0.5 pl-2.5 pr-1.5 text-xs text-orange-900 transition-colors hover:bg-orange-200"
            >
              {cause.title}
              <XMarkIcon
                className="h-3.5 w-3.5 text-orange-400 transition-colors group-hover:text-orange-700"
                aria-hidden="true"
              />
            </button>
          ))}
          <button
            onClick={() => setIncludedCauses([])}
            className="px-1 text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            Clear
          </button>
        </Row>
      )}
      <div className="mt-2 flex flex-col gap-5 sm:mt-5 sm:gap-10">
        {fundableProjects.length > 0 && (
          <div>
            <ProjectGroup projects={fundableProjects} prices={prices} />
          </div>
        )}
        {completeProjects.length > 0 && (
          <div>
            <h1 className="mb-2 text-lg font-bold text-gray-900 sm:text-2xl">Complete Projects</h1>
            <ProjectGroup projects={completeProjects} prices={prices} />
          </div>
        )}
        {unfundedProjects.length > 0 && (
          <div>
            <h1 className="mb-2 text-lg font-bold text-gray-900 sm:text-2xl">Unfunded Projects</h1>
            <ProjectGroup projects={unfundedProjects} prices={prices} />
          </div>
        )}
      </div>
      <LoadMoreUntilNotVisible
        loadMore={() => {
          setNumToShow(numToShow + CLIENT_PAGE_SIZE)
          return Promise.resolve(true)
        }}
      />
    </Col>
  )
}
function sortProjects(projects: FullProject[], sortType: SortOption) {
  projects.forEach((project) => {
    project.bids = project.bids.filter((bid) => bid.status == 'pending')
  })
  if (sortType === 'votes') {
    return sortBy(projects, [countVotes]).reverse()
  }
  if (sortType === 'newest') {
    return sortBy(projects, [(project) => -new Date(project.created_at)])
  }
  if (sortType === 'funding') {
    return sortBy(projects, [(project) => -getAmountRaised(project, project.bids, project.txns)])
  }
  if (sortType === 'hot') {
    return sortBy(projects, [hotScore])
  }
  if (sortType === 'closing soon') {
    return sortBy(projects, [
      (project) => {
        // Show proposals with a close date of today or later
        if (project.stage === 'proposal' && project.auction_close) {
          const closeDate = new Date(`${project.auction_close}T23:59:59-12:00`)
          if (closeDate >= new Date()) {
            return closeDate.getTime()
          }
        }
        return Infinity
      },
    ])
  }
  return projects
}

function filterProjects(projects: FullProject[], includedCauses: MiniCause[]) {
  if (includedCauses.length === 0) return projects
  return projects.filter((project) => {
    return project.causes.some((cause) => {
      return includedCauses.some((includedCause) => {
        return cause.slug === includedCause.slug
      })
    })
  })
}

function SortSelect(props: { sortBy: SortOption; setSortBy: (option: SortOption) => void }) {
  const { sortBy, setSortBy } = props
  return (
    <Listbox value={sortBy} onChange={setSortBy}>
      <div className="relative">
        <Listbox.Button className="flex h-full cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-white py-1.5 pl-3 pr-2 text-sm capitalize text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 transition-transform focus:outline-none focus:ring-2 focus:ring-orange-500 active:scale-[0.96] sm:text-base">
          {sortBy}
          <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Listbox.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="-translate-y-1 opacity-0"
          enterTo="translate-y-0 opacity-100"
          leave="transition ease-in duration-100"
          leaveFrom="translate-y-0 opacity-100"
          leaveTo="-translate-y-0.5 opacity-0"
        >
          <Listbox.Options className="absolute right-0 z-10 mt-1.5 w-44 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <p className="px-2.5 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              Sort by
            </p>
            {DEFAULT_SORT_OPTIONS.map((option) => (
              <Listbox.Option
                key={option}
                value={option}
                className={({ active }) =>
                  clsx(
                    'flex cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-1.5 text-sm capitalize',
                    active ? 'bg-orange-50 text-orange-900' : 'text-gray-700'
                  )
                }
              >
                {({ selected }) => (
                  <>
                    <span className={selected ? 'font-medium text-gray-900' : undefined}>
                      {option}
                    </span>
                    {selected && (
                      <CheckIcon className="h-4 w-4 text-orange-600" aria-hidden="true" />
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}

function FilterPopover(props: {
  causes: MiniCause[]
  includedCauses: MiniCause[]
  setIncludedCauses: (causes: MiniCause[]) => void
  slopCount: number
  hideSlop: boolean
  setHideSlop: (hide: boolean) => void
}) {
  const { causes, includedCauses, setIncludedCauses, slopCount, hideSlop, setHideSlop } = props
  const activeCount = includedCauses.length + (slopCount > 0 && !hideSlop ? 1 : 0)
  const toggleCause = (cause: MiniCause) => {
    if (includedCauses.some((c) => c.slug === cause.slug)) {
      setIncludedCauses(includedCauses.filter((c) => c.slug !== cause.slug))
    } else {
      setIncludedCauses([...includedCauses, cause])
    }
  }
  return (
    <Popover className="relative flex">
      <Popover.Button
        className={clsx(
          'relative flex w-10 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-inset transition-transform focus:outline-none focus:ring-2 focus:ring-orange-500 active:scale-[0.96]',
          activeCount > 0 ? 'text-orange-600 ring-orange-300' : 'text-gray-500 ring-gray-300'
        )}
        aria-label="Filter projects"
      >
        <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-medium tabular-nums text-white">
            {activeCount}
          </span>
        )}
      </Popover.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="-translate-y-1 opacity-0"
        enterTo="translate-y-0 opacity-100"
        leave="transition ease-in duration-100"
        leaveFrom="translate-y-0 opacity-100"
        leaveTo="-translate-y-0.5 opacity-0"
      >
        <Popover.Panel className="absolute right-0 top-full z-10 mt-1.5 w-64 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {causes.length > 0 && (
            <>
              <Row className="items-center justify-between px-2.5 pb-1 pt-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Causes</p>
                {includedCauses.length > 0 && (
                  <button
                    onClick={() => setIncludedCauses([])}
                    className="text-xs text-gray-400 transition-colors hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </Row>
              <div className="max-h-56 overflow-auto">
                {causes.map((cause) => {
                  const selected = includedCauses.some((c) => c.slug === cause.slug)
                  return (
                    <button
                      key={cause.slug}
                      onClick={() => toggleCause(cause)}
                      className={clsx(
                        'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
                        selected ? 'bg-orange-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <CauseTag causeTitle={cause.title} causeSlug={cause.slug} noLink />
                      {selected && (
                        <CheckIcon
                          className="h-4 w-4 shrink-0 text-orange-600"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {slopCount > 0 && (
            <>
              {causes.length > 0 && <div className="my-1.5 h-px bg-gray-100" />}
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition-colors hover:bg-gray-50">
                <span className="text-sm text-gray-700">
                  Show slop
                  <span className="block text-xs text-gray-400">
                    {slopCount} likely AI-written {slopCount === 1 ? 'project' : 'projects'}
                  </span>
                </span>
                <Checkbox
                  checked={!hideSlop}
                  onChange={(event) => setHideSlop(!event.target.checked)}
                />
              </label>
            </>
          )}
        </Popover.Panel>
      </Transition>
    </Popover>
  )
}

// Price here means goal for grants and valuation for certs
function getPrices(projects: FullProject[]) {
  const prices = Object.fromEntries(projects.map((project) => [project.id, 0]))
  projects.forEach((project) => {
    prices[project.id] = getProjectValuation(project)
  })
  return prices
}
