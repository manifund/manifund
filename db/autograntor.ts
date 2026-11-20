import 'server-only'
import { createAdminClient } from '@/db/edge'
import { Tables } from '@/db/database.types'

export type AutograntorResult = {
  amount: number
  mean: number
  median: number
  p10: number
  p90: number
  p_negative: number
  post2030_share: number
}
export type AutograntorEval = Omit<Tables<'project_autograntor_evals'>, 'results'> & {
  results: AutograntorResult[]
}

// Admin-only (P17): the table has no RLS policies, so these read with the service role. Callers check isAdmin.
export async function getAutograntorEvals(projectId: string) {
  const { data } = await createAdminClient()
    .from('project_autograntor_evals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .throwOnError()
  return (data ?? []) as unknown as AutograntorEval[]
}

export async function getLatestAutograntorRunAt(projectId: string) {
  const { data } = await createAdminClient()
    .from('project_autograntor_evals')
    .select('created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError()
  return data?.created_at ?? null
}
