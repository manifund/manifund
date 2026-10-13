import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { listMyFollowedProjects, listMyFollows, listMySavedSearches } from '@/db/profile-follows'
import { SubscriptionsList } from './subscriptions-list'

// What you follow (F9): people, saved searches and projects, in one place. Private: only you see it (F2).
export default async function SubscriptionsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) redirect('/login?next=/settings/subscriptions')
  const [people, searches, projects] = await Promise.all([
    listMyFollows(supabase, user.id),
    listMySavedSearches(supabase, user.id),
    listMyFollowedProjects(supabase, user.id),
  ])
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium">Following</h1>
      <p className="mb-5 mt-1 text-sm text-gray-700">
        People, searches and projects you follow. Only you see this list. Choose how often you get
        emails about them in your{' '}
        <Link href="/settings/notifications" className="text-orange-600 hover:underline">
          notification settings
        </Link>
        .
      </p>
      <SubscriptionsList people={people} searches={searches} projects={projects} />
    </div>
  )
}
