import 'server-only'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { createAdminClient } from '@/db/supabase-admin'
import { getProfileById } from '@/db/profile'

// The signed-in person's profile, from the request's session cookie; undefined if signed out.
export async function getSignedInProfile() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return undefined
  return getProfileById(createAdminClient(), user.id)
}
