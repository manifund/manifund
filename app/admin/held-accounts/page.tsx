import Link from 'next/link'
import { createAdminClient } from '@/db/supabase-admin'
import { RelativeTime } from '@/components/relative-time'
import { requireAdmin } from '@/lib/require-admin'
import { categoryText } from '@/utils/moderation-labels'
import { ResolveHold } from './resolve-hold'

export const dynamic = 'force-dynamic'

// Accounts held at sign-up or after a rename (U5): clear them or ban them.
export default async function HeldAccountsPage() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: holds } = await admin
    .from('account_holds')
    .select(
      'profile_id, held_at, reason, categories, model, profile:profiles!account_holds_profile_id_fkey(username, full_name, created_at)'
    )
    .not('held_at', 'is', null)
    .is('cleared_at', null)
    .order('held_at', { ascending: true })
    .throwOnError()
  const ids = (holds ?? []).map((h) => h.profile_id)
  const { data: users } = ids.length
    ? await admin.from('users').select('id, email').in('id', ids).throwOnError()
    : { data: [] }
  const emailOf = new Map((users ?? []).map((u) => [u.id, u.email]))

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-xl font-medium">Held accounts</h2>
      {!holds?.length && <p className="text-sm text-gray-500">No accounts waiting for review.</p>}
      <div className="flex flex-col gap-4">
        {(holds ?? []).map((h: any) => (
          <div key={h.profile_id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                href={`/${h.profile?.username}`}
                className="font-medium text-orange-600 hover:underline"
              >
                @{h.profile?.username}
              </Link>
              <span className="text-gray-900">{h.profile?.full_name}</span>
              <span className="text-gray-500">{emailOf.get(h.profile_id)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>
                Joined <RelativeTime date={h.profile?.created_at} />
              </span>
              <span>·</span>
              <span>
                Held <RelativeTime date={h.held_at} />
              </span>
            </div>
            <p className="mt-2 text-sm">
              <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                {categoryText(h.categories)}
              </span>{' '}
              <span className="text-gray-900">{h.reason}</span>{' '}
              <span className="text-xs text-gray-400">({h.model})</span>
            </p>
            <ResolveHold profileId={h.profile_id} username={h.profile?.username} />
          </div>
        ))}
      </div>
    </div>
  )
}
