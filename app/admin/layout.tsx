import { getUser, isAdmin } from '@/db/profile'
import { createServerSupabaseClient } from '@/db/supabase-server'
import NoAccess from '../no-access'
import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/db/edge'
import { HomeIcon } from '@heroicons/react/24/outline'

// Revalidate every 5 minutes
export const revalidate = 300

// Separate components for each count to allow parallel loading
async function UserCount() {
  const supabase = createAdminClient()
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true })

  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {count}
    </span>
  )
}

async function TransactionCount() {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('txns')
    .select('*', { count: 'exact', head: true })
    .eq('token', 'USD')

  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {count}
    </span>
  )
}

async function ProjectCount() {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .neq('stage', 'hidden')
    .neq('stage', 'draft')

  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {count}
    </span>
  )
}

// Loading fallback for counts
function CountLoading() {
  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      ...
    </span>
  )
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user || !isAdmin(user)) {
    return <NoAccess />
  }

  const tabs = [
    {
      name: 'Pending Approval',
      path: '/admin/approvals',
    },
    {
      name: 'Users',
      path: '/admin/users',
      count: (
        <Suspense fallback={<CountLoading />}>
          <UserCount />
        </Suspense>
      ),
    },
    {
      name: 'Transactions',
      path: '/admin/transactions',
      count: (
        <Suspense fallback={<CountLoading />}>
          <TransactionCount />
        </Suspense>
      ),
    },
    {
      name: 'Projects',
      path: '/admin/projects',
      count: (
        <Suspense fallback={<CountLoading />}>
          <ProjectCount />
        </Suspense>
      ),
    },
    { name: 'Reported comments', path: '/admin/comment-reports' },
    { name: 'Tools', path: '/admin/tools' },
  ]

  return (
    <div className="fixed inset-0 flex h-screen w-screen flex-col overflow-auto bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-rose-500 p-2">
        <div className="flex items-center">
          <Link href="/" className="p-2 text-white hover:text-gray-200">
            <HomeIcon className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-center text-lg text-white">Manifund admin ({user.email})</h1>
        </div>
      </div>

      <nav className="border-b border-gray-200">
        <div className="flex space-x-8 px-4">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              className="border-b-2 border-transparent px-3 py-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              {tab.name}
              {tab.count}
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  )
}
