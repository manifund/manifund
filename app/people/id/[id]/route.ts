import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/db/supabase-server'

// /people/id/<user id> → the person's profile under their current username. Mentions link here,
// so they keep working after a rename (31 of 1,353 mentions pointed to old usernames, 2026-09-28).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('profiles').select('username').eq('id', id).maybeSingle()
  return NextResponse.redirect(new URL(data ? `/${data.username}` : '/people', request.url))
}
