import { Database } from '@/db/database.types'
import { SupabaseClient, User } from '@supabase/supabase-js'
import { Txn } from '@/db/txn'
import { Bid } from './bid'
import { ProjectEval } from './eval'
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileAndTxns = Profile & { txns: Txn[] }
export type ProfileAndBids = Profile & { bids: Bid[] }
export type ProfileAndProjectTitles = Profile & {
  projects: { title: string }[]
}
export type ProfileAndEvals = Profile & { project_evals: ProjectEval[] }
export type ProfileRoles = Database['public']['Tables']['profile_roles']['Row']

export type ProfileWithRoles = Profile & {
  roles: ProfileRoles
}

const ADMINS = ['akrolsmir@gmail.com', 'hannah@manifund.org', 'carol@manifund.org']

// POC comments (local only): the fictional persona rita@local.test acts as an admin in
// development, so the report queue can be demoed. Never true in production builds.
const LOCAL_ADMINS = process.env.NODE_ENV === 'development' ? ['rita@local.test'] : []

export function isAdmin(user: User | null) {
  return ADMINS.includes(user?.email ?? '') || LOCAL_ADMINS.includes(user?.email ?? '')
}

export async function getProfileById(supabase: SupabaseClient, id: string = '') {
  if (!id) {
    return undefined
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id)
  if (error) {
    throw error
  }
  return data[0] ? (data[0] as Profile) : undefined
}

export async function getProfileAndBidsById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('profiles').select('*, bids(*)').eq('id', id)
  if (error) {
    throw error
  }
  return data[0] as ProfileAndBids
}

export async function getProfileByUsername(supabase: SupabaseClient, username: string = '') {
  if (!username) {
    return null
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username)
  if (error) {
    throw error
  }
  return data[0] ? (data[0] as Profile) : null
}
export async function getProfileAndBidsByUsername(supabase: SupabaseClient, username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, bids(*)')
    .eq('username', username)
  if (error) {
    throw error
  }
  return data[0] as ProfileAndBids
}

export async function getUser(supabase: SupabaseClient<Database>) {
  const resp = await supabase.auth.getUser()
  return resp.data.user
}

export type MiniProfile = Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name' | 'type'>
export async function getAllMiniProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, full_name, type')
  if (error) {
    throw error
  }
  return data as MiniProfile[]
}

// Doesn't account for charities giving to other organizations yet
export async function listOrgs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, txns!txns_to_id_fkey(*)')
    .eq('type', 'org')
  if (error) {
    throw error
  }
  return data as ProfileAndTxns[]
}

export async function getRegranters(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('regranter_status', true)
    .throwOnError()
  return data as Profile[]
}

export async function listProfiles(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('profiles')
    .select('*, projects!projects_creator_fkey(title)')
    .throwOnError()
  return data as ProfileAndProjectTitles[]
}

export async function getTeamProfiles(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or('full_name.eq.Austin Chen, full_name.eq.Rachel Weinberg')
    .throwOnError()
  return data as Profile[]
}

export async function listProfilesAndEvals(supabase: SupabaseClient) {
  const { data: profiles, error } = await supabase.from('profiles').select('*, project_evals(*)')
  if (error) {
    throw error
  }
  return profiles as ProfileAndEvals[]
}

export async function getFundByUsername(supabase: SupabaseClient, username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, bio, long_description')
    .eq('username', username)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data
}

export async function getProfileRoles(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from('profile_roles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
    .throwOnError()
  return data as ProfileRoles | undefined
}

export async function getProfilesWithRoles(supabase: SupabaseClient): Promise<ProfileWithRoles[]> {
  const { data } = await supabase.from('profile_roles').select(`*, profiles (*)`).throwOnError()

  return (data ?? []).map(
    (item) =>
      ({
        ...item.profiles,
        roles: { ...item, profiles: undefined },
      }) as ProfileWithRoles
  )
}
