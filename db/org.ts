import { Database } from '@/db/database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { FullProject } from './project'

export type Org = Database['public']['Tables']['orgs']['Row']

// A grant the org received, as Trace records it.
export type OrgGrant = {
  amountUsd: number | null
  date: string | null
  funderSlug: string
  funderName: string
}
export type OrgPerson = { name: string; title: string | null; leadership: boolean }
export type OrgTeam = { headcount: number | null; sourceUrl: string | null; people: OrgPerson[] }
// A review published elsewhere (e.g. Zvi's, Michael Dickens's), collected by Trace.
export type ExternalReview = {
  id: string
  reviewer: string
  reviewerUrl: string | null
  sourceUrl: string | null
  reviewedAt: string
  body: string
}
// What public sources say about the org: read live from the trace schema, never copied.
export type OrgTrace = {
  slug: string
  grants: OrgGrant[]
  team: OrgTeam | null
  reviews: ExternalReview[]
}

export async function listOrgs(supabase: SupabaseClient) {
  const { data } = await supabase.from('orgs').select('*').order('name').throwOnError()
  return (data ?? []) as Org[]
}

export async function getOrgBySlug(supabase: SupabaseClient, slug: string) {
  const { data } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
    .throwOnError()
  return data as Org | null
}

// The org's projects on Manifund, newest first; hidden and draft ones stay out.
export async function getOrgProjects(supabase: SupabaseClient, orgId: string) {
  const { data } = await supabase
    .from('org_projects')
    .select(
      'projects(*, profiles!projects_creator_fkey(*), bids(*), txns(*), comments(id), rounds(*), project_transfers(id, project_id, recipient_name, transferred, created_at), project_votes(*), project_follows(follower_id), causes(title, slug))'
    )
    .eq('org_id', orgId)
    .throwOnError()
  const projects = (data ?? []).map((row) => row.projects as unknown as FullProject)
  return projects
    .filter((project) => project && project.stage !== 'hidden' && project.stage !== 'draft')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

// Trace's rows for one org, by its Trace slug. Trace only exposes approved grants; the page's totals are a plain
// sum of what the org received, as on trace.manifund.org's own org page. Null when the slug no longer matches a
// row (Trace merges and rebuilds its orgs).
export async function getOrgTrace(supabase: SupabaseClient, traceSlug: string) {
  const trace = supabase.schema('trace' as never) as unknown as SupabaseClient
  const { data: org } = await trace
    .from('orgs')
    .select('id, slug')
    .eq('slug', traceSlug)
    .maybeSingle()
    .throwOnError()
  if (!org) return null
  const [{ data: grants }, { data: team }, { data: people }, { data: reviews }] = await Promise.all(
    [
      trace
        .from('grants')
        .select('amount_usd, grant_date, funder:orgs!grants_funder_org_id_fkey(slug, name)')
        .eq('recipient_org_id', org.id)
        .eq('status', 'approved')
        .order('grant_date', { ascending: false, nullsFirst: false })
        .throwOnError(),
      trace
        .from('org_teams')
        .select('headcount, source_url')
        .eq('org_id', org.id)
        .maybeSingle()
        .throwOnError(),
      trace
        .from('org_people')
        .select('name, title, leadership')
        .eq('org_id', org.id)
        .order('sort_order')
        .throwOnError(),
      trace
        .from('org_reviews')
        .select('id, reviewer, reviewer_url, source_url, reviewed_at, body')
        .eq('org_id', org.id)
        .order('reviewed_at', { ascending: false })
        .throwOnError(),
    ]
  )
  const result: OrgTrace = {
    slug: org.slug,
    grants: (grants ?? []).map((grant: any) => ({
      amountUsd: grant.amount_usd,
      date: grant.grant_date,
      funderSlug: grant.funder?.slug ?? '',
      funderName: grant.funder?.name ?? 'Unknown',
    })),
    team: team
      ? {
          headcount: team.headcount,
          sourceUrl: team.source_url,
          people: (people ?? []) as OrgPerson[],
        }
      : null,
    reviews: (reviews ?? []).map((review: any) => ({
      id: review.id,
      reviewer: review.reviewer,
      reviewerUrl: review.reviewer_url,
      sourceUrl: review.source_url,
      reviewedAt: review.reviewed_at,
      body: review.body,
    })),
  }
  return result
}
