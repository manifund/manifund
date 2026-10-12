import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { Project } from './project'

export type ProjectTransfer = Database['public']['Tables']['project_transfers']['Row']
export type ProjectTransferAndProject = ProjectTransfer & {
  projects: Project
}

// Matched ignoring case: Supabase Auth stores emails in lowercase, while older
// transfers keep the email as the regrantor typed it. ilike treats _ and % as wildcards, so it may return a few
// near-misses; the exact comparison below drops them.
export async function getTransfersByEmail(supabase: SupabaseClient, recipientEmail: string) {
  const email = normalizeEmail(recipientEmail)
  if (!email) return []
  const { data, error } = await supabase
    .from('project_transfers')
    .select('*, projects(*)')
    .ilike('recipient_email', email)
  if (error) {
    throw error
  }
  return (data as ProjectTransferAndProject[]).filter(
    (transfer) => normalizeEmail(transfer.recipient_email) === email
  )
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

// The account that signed up with this email, if any. Needs the service-role client: emails are
// not readable by signed-in people.
export async function getAccountIdByEmail(supabaseAdmin: SupabaseClient, email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalized)
    .limit(1)
  if (error) {
    throw error
  }
  return (data?.[0]?.id as string | undefined) ?? null
}

export async function getIncompleteTransfers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('project_transfers')
    .select('*, projects(*)')
    .eq('transferred', false)
  if (error) {
    throw error
  }
  return data as ProjectTransferAndProject[]
}
