import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getProfileById, getUser } from '@/db/profile'

// What you follow now lives on your profile (F9, Vals 2026-10-14). This address stays as a redirect so the links
// that point here (the home bell, the Network tab, emails already sent) land on that section.
export default async function SubscriptionsRedirect() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) redirect('/login?next=/settings/subscriptions')
  const profile = await getProfileById(supabase, user.id)
  redirect(profile ? `/${profile.username}#following` : '/')
}
