import Link from 'next/link'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { listOrgs } from '@/db/org'
import { OrgLogo } from './org-logo'

export const revalidate = 60
export const metadata = { title: 'Orgs' }

export default async function OrgsPage() {
  const supabase = await createServerSupabaseClient()
  const orgs = await listOrgs(supabase)
  return (
    <div className="p-4">
      <h1 className="text-3xl font-medium tracking-tight text-gray-900">Orgs</h1>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {orgs.map((org) => (
          <Link
            key={org.id}
            href={`/orgs/${org.slug}`}
            className="flex items-start gap-4 rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow"
          >
            <OrgLogo org={org} className="h-12 w-12 rounded-lg text-[11px]" />
            <div className="min-w-0">
              <div className="font-medium text-gray-900">{org.name}</div>
              {org.summary && (
                <p className="mt-0.5 line-clamp-2 text-sm font-light text-gray-600">
                  {org.summary}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
