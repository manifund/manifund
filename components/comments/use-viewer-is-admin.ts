'use client'
import { useSupabase } from '@/db/supabase-provider'
import { isAdmin } from '@/db/profile'

// Whether to show moderator actions. Display only: the server checks again.
export function useViewerIsAdmin() {
  const { session } = useSupabase()
  return isAdmin(session?.user ?? null)
}
