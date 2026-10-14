import { Suspense } from 'react'
import { createPublicSupabaseClient, createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { Col } from '@/components/layout/col'
import { FeedTabs } from './feed-tabs'
import { countFeedComments, getRecentFullComments } from '@/db/comment'
import { getRecentFullTxns } from '@/db/txn'
import { getRecentFullBids } from '@/db/bid'
import { listSimpleCauses } from '@/db/cause'
import { listProjects } from '@/db/project'
import { getHotProjectsCached } from '@/db/project-cached'
import { LandingSection } from './landing-section'
import { listMySavedSearches, networkFor } from '@/db/profile-follows'
import type { NetworkActivity } from '@/components/follows/network-tag'
import type { NotifyState } from '@/components/follows/save-search'

// Page is dynamic due to cookies(), but listProjects is cached for 30s

export default async function Projects(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  // what people the viewer follows did lately, for the network line on cards (F8), and their saved searches for
  // the bell (F5)
  const [network, notify] = user
    ? await Promise.all([
        networkFor(supabase, user.id),
        listMySavedSearches(supabase, user.id).then(
          (searches): NotifyState => ({
            searches: searches.map((s) => ({ id: s.id, query: s.query })),
          })
        ),
      ])
    : [undefined, null]

  return (
    <Col className="gap-16 px-3 py-5 sm:px-6">
      {user === null && (
        <>
          <LandingSection />
          {/* <CausesSection /> */}
          {/* Or use <CausesWithFeatured /> to include active rounds */}
        </>
      )}
      {/* Use nested suspense to load the full feed after the fast feed */}
      <Suspense
        fallback={
          <Suspense fallback={<FeedTabsSkeleton />}>
            <AsyncFeedTabs
              searchParams={await props.searchParams}
              userId={user?.id}
              network={network}
              notify={notify}
              useHotProjects={true}
            />
          </Suspense>
        }
      >
        <AsyncFeedTabs
          searchParams={await props.searchParams}
          userId={user?.id}
          network={network}
          notify={notify}
          useHotProjects={false}
        />
      </Suspense>
    </Col>
  )
}

// Separate component for async feed data
async function AsyncFeedTabs({
  searchParams,
  userId,
  network,
  notify,
  useHotProjects,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
  userId?: string
  network?: NetworkActivity
  notify: NotifyState | null
  useHotProjects: boolean
}) {
  const PAGE_SIZE = 20
  const page = parseInt(searchParams?.p as string) || 1
  const tab = searchParams?.tab as string
  const show = searchParams?.show as string
  const filter = (['updates', 'grants', 'discussion'] as const).find((f) => f === show)
  // Hack for faster loading: don't load projects on other tabs
  // Ideally, we'd structure NextJS routing to only load the needed data
  const shouldLoadProjects = !tab || tab === 'projects'
  const start = (page - 1) * PAGE_SIZE

  const supabase = createPublicSupabaseClient()
  const loadProjects = async () => {
    if (!shouldLoadProjects) return []
    if (useHotProjects) {
      return await getHotProjectsCached()
    }
    return await listProjects(supabase)
  }

  const [projects, recentComments, commentsTotal, recentDonations, recentBids, causesList] =
    await Promise.all([
      loadProjects(),
      getRecentFullComments(supabase, PAGE_SIZE, start, filter),
      tab === 'comments' ? countFeedComments(supabase, filter) : Promise.resolve(0),
      getRecentFullTxns(supabase, PAGE_SIZE, start),
      getRecentFullBids(supabase, PAGE_SIZE, start),
      listSimpleCauses(supabase),
    ])

  return (
    <FeedTabs
      recentComments={recentComments}
      commentsTotal={commentsTotal}
      recentDonations={recentDonations}
      recentBids={recentBids}
      projects={projects}
      causesList={causesList}
      userId={userId}
      network={network}
      savedSearches={{ account: notify, initialQuery: toQueryString(searchParams) }}
    />
  )
}

function toQueryString(searchParams: { [key: string]: string | string[] | undefined }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {}))
    for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v)
  return params.toString()
}

function FeedTabsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="mt-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded bg-gray-200" />
        ))}
      </div>
    </div>
  )
}
