import { NextResponse } from 'next/server'
import { recomputeKarma } from '@/db/karma'
import { createAdminClient } from '@/db/supabase-admin'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser, isAdmin } from '@/db/profile'
import { invalidateProjectsCache } from '@/db/project-cached'

export const maxDuration = 300

// Admin "recompute now" button. App Router so revalidateTag works.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }
  try {
    const summary = await recomputeKarma(createAdminClient())
    invalidateProjectsCache()
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Karma recompute failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
