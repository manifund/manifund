import { Database } from '@/db/database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { sortBy, uniq } from 'es-toolkit'

// Prize causes that are only selectable via a direct ?prize=<slug> link — never
// shown by default on /create, and not addable through the edit-project UI.
export const LINK_ONLY_PRIZE_CAUSE_SLUGS = ['leo-microgrants', 'grantmaking-ai']

export type Cause = Omit<Database['public']['Tables']['causes']['Row'], 'cert_params'> & {
  cert_params: CertParams | null
}
export type FullCause = Cause & { projects: { stage: string; type: string }[] }
export type MiniCause = { title: string; slug: string }
export type SimpleCause = {
  title: string
  slug: string
  prize: boolean
  open: boolean
}

export type CertParams = {
  ammShares: number
  ammDollars: number | null
  minMinFunding: number
  proposalPhase: boolean
  auction?: boolean
  ammOwnedByCreator?: boolean
  defaultInvestorShares: number
  adjustableInvestmentStructure: boolean
  judgeUnfundedProjects: boolean
}

export async function listFullCauses(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('causes').select('*, projects(stage)')
  if (error) {
    throw error
  }
  const sortedCauses = sortBy(data, ['name'])
  return sortedCauses as FullCause[]
}

export async function getSomeFullCauses(causeSlugs: string[], supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('causes')
    .select('*, projects(stage, type)')
    .in('slug', causeSlugs)
  if (error) {
    throw error
  }
  const sortedCauses = sortBy(data, ['name'])
  return sortedCauses as FullCause[]
}

export async function listMiniCauses(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('causes').select('title, slug')
  if (error) {
    throw error
  }
  return data as MiniCause[]
}

export async function listSimpleCauses(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('causes').select('title, slug, prize, open')
  if (error) {
    throw error
  }
  return data as SimpleCause[]
}

export async function listCauses(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('causes').select('*')
  if (error) {
    throw error
  }
  return data as Cause[]
}

export async function getPrizeCause(causeSlugs: string[], supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('causes')
    .select('*')
    .in('slug', causeSlugs)
    .eq('prize', true)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data ? (data as Cause) : undefined
}

export async function updateProjectCauses(
  supabase: SupabaseClient,
  causeSlugs: string[],
  projectId: string
) {
  const uniqCauseSlugs = uniq(causeSlugs)
  await supabase.from('project_causes').delete().eq('project_id', projectId).throwOnError()
  await supabase
    .from('project_causes')
    .insert(
      uniqCauseSlugs.map((slug) => ({
        project_id: projectId,
        cause_slug: slug,
      }))
    )
    .throwOnError()
}

export async function getCause(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase.from('causes').select('*').eq('slug', slug)
  if (error) {
    throw error
  }
  return data[0] as Cause
}
