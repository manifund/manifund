import { NextResponse } from 'next/server'
import { createAdminClient } from '@/db/supabase-admin'
import { getSignedInProfile } from '@/lib/comments/auth'

export const runtime = 'nodejs'

// POST /api/notifications/read: mark all of the signed-in person's notifications as read.
export async function POST() {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  await createAdminClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me.id)
    .is('read_at', null)
    .throwOnError()
  return NextResponse.json({ ok: true })
}
