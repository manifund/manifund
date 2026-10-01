import 'server-only'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser, isAdmin } from '@/db/profile'

// Call at the top of every admin page and route, before any admin-client query. The admin layout's
// check isn't enough: in the App Router a page renders (and its data is sent) even when the layout
// shows "no access". Non-admins get a 404.
export async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user || !isAdmin(user)) notFound()
  return user
}
