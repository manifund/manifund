import { SupabaseClient } from '@supabase/supabase-js'
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

export async function getAutograntorEvals(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase
    .from('project_autograntor_evals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .throwOnError()
  return (data ?? []) as AutograntorEval[]
}
