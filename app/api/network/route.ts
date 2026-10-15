import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { networkFeed } from '@/db/network'

// The Network tab (docs/product/follows, F12): what the people the signed-in person follows did, newest 50.
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) return NextResponse.json({ error: 'Sign in to see your network' }, { status: 401 })
  return NextResponse.json({ items: await networkFeed(supabase, user.id) })
}
