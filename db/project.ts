import { Database } from './database.types'
import { SupabaseClient } from '@supabase/supabase-js'
import { Bid } from './bid'
import { Txn } from './txn'
import { Profile } from './profile'
import { Comment } from '@/db/comment'
import { Round } from './round'
import { CertParams, MiniCause } from './cause'
import { ProjectFollow } from './follows'
import { countVotes } from '@/utils/sort'

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type ProjectTransfer = Database['public']['Tables']['project_transfers']['Row']
export type ProjectVote = Database['public']['Tables']['project_votes']['Row']
export type ProjectWithCauses = Project & { causes: MiniCause[] }
export type ProjectAndProfile = Project & { profiles: Profile }
export type ProjectAndBids = Project & { bids: Bid[] }
export type ProjectBidsAndFollows = Project & { bids: Bid[] } & {
  project_follows: ProjectFollow[]
} & { causes: { cert_params: CertParams | null }[] }
export type FullProject = Project & { profiles: Profile } & {
  bids: Bid[]
} & { txns: Txn[] } & { comments: Comment[] } & { rounds: Round } & {
  project_transfers: ProjectTransfer[]
} & { project_votes: ProjectVote[] } & { causes: MiniCause[] } & {
  project_follows: ProjectFollow[]
}
export type FullProjectWithSimilarity = FullProject & { similarity: number }
export type MiniProject = Project & { profiles: Profile } & { txns: Txn[] }
export const TOTAL_SHARES = 10_000_000

export async function getProjectBySlug(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase.from('projects').select('*').eq('slug', slug)
  if (error) {
    throw error
  }
  return data[0] as Project
}

export async function getProjectById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id)
  if (error) {
    throw error
  }
  return data[0] as Project
}

export async function getProjectsByUser(supabase: SupabaseClient, user: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, bids(*), txns(*), comments(*), rounds(*), project_transfers(id, project_id, recipient_name, transferred, created_at)')
    .eq('creator', user)
  if (error) {
    throw error
  }
  return data as FullProject[]
}

export async function listProjects(supabase: SupabaseClient, limitToProjectIds?: string[]) {
  // get base project data with only essential joins
  let query = supabase.from('projects').select(
    `
      title, id, created_at, creator, slug, blurb, stage,
      auction_close, funding_goal, min_funding, type, approved,
      signed_agreement, lobbying, amm_shares, founder_shares,
      ai_fraction, quality_score,
      profiles!projects_creator_fkey(*),
      rounds(title, slug),
      causes(title, slug)
    `
  )

  // if specific project IDs are provided, filter by them
  if (limitToProjectIds && limitToProjectIds.length > 0) {
    if (limitToProjectIds.length > 1000) {
      throw new Error(
        `Cannot fetch more than 1000 projects at once. Requested: ${limitToProjectIds.length}`
      )
    }
    query = query.in('id', limitToProjectIds)
  }
  query = query
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .order('created_at', { ascending: false })

  const { data: projectsBase } = await query.throwOnError()

  if (!projectsBase || projectsBase.length === 0) {
    return []
  }

  const projectIds = projectsBase.map((p) => p.id)

  // fetch related data in parallel batches
  const batchSize = 200
  const batches = []

  for (let i = 0; i < projectIds.length; i += batchSize) {
    batches.push(projectIds.slice(i, i + batchSize))
  }

  // fetch all related data in parallel
  const fetchPromises = batches.map(async (batchIds) => {
    const [bids, txns, votes, transfers, comments] = await Promise.all([
      supabase.from('bids').select('*').in('project', batchIds),

      supabase.from('txns').select('*').in('project', batchIds),

      supabase.from('project_votes').select('project_id, magnitude').in('project_id', batchIds),

      supabase.from('project_transfers').select('id, project_id, recipient_name, transferred, created_at').in('project_id', batchIds),

      supabase.from('comments').select('project, id').in('project', batchIds),
    ])

    return {
      bids: bids.data,
      txns: txns.data,
      votes: votes.data,
      transfers: transfers.data,
      comments: comments.data,
    }
  })

  const batchResults = await Promise.all(fetchPromises)

  // merge all data
  const projectsMap = new Map<string, any>()

  // shape the data
  projectsBase.forEach((project) => {
    projectsMap.set(project.id, {
      ...project,
      bids: [],
      txns: [],
      comments: [],
      project_votes: [],
      project_transfers: [],
    })
  })

  // Merge batch results
  batchResults.forEach((batch) => {
    batch.bids?.forEach((bid) => {
      const project = projectsMap.get(bid.project)
      if (project) project.bids.push(bid)
    })

    batch.txns?.forEach((txn) => {
      if (txn.project) {
        const project = projectsMap.get(txn.project)
        if (project) project.txns.push(txn)
      }
    })

    batch.votes?.forEach((vote) => {
      const project = projectsMap.get(vote.project_id)
      if (project) project.project_votes.push(vote)
    })

    batch.transfers?.forEach((transfer) => {
      const project = projectsMap.get(transfer.project_id)
      if (project) project.project_transfers.push(transfer)
    })

    // Process comments
    if (batch.comments) {
      const commentCountMap = new Map<string, number>()
      batch.comments.forEach((comment) => {
        const count = commentCountMap.get(comment.project) || 0
        commentCountMap.set(comment.project, count + 1)
      })

      commentCountMap.forEach((count, projectId) => {
        const project = projectsMap.get(projectId)
        if (project) {
          project.comments = Array(count).fill({ id: '' })
        }
      })
    }
  })

  return Array.from(projectsMap.values()) as FullProject[]
}

export async function listProjectsForEvals(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('projects')
    .select(
      'id, title, creator, slug, stage, type, funding_goal, external_link, profiles!projects_creator_fkey(*), txns(*)'
    )
    .neq('type', 'cert')
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .order('created_at', { ascending: false })
    .throwOnError()
  // Scary type conversion!
  return data as unknown as MiniProject[]
}

export async function getFullProjectBySlug(supabase: SupabaseClient, slug: string) {
  const { data } = await supabase
    .from('projects')
    .select(
      '*, profiles!projects_creator_fkey(*), bids(*), txns(*), comments(*), rounds(*), project_transfers(id, project_id, recipient_name, transferred, created_at), project_votes(*), project_follows(follower_id), causes(title, slug)'
    )
    .eq('slug', slug)
    .throwOnError()
  if (data === null) {
    return null
  }
  return data[0] as FullProject
}

export async function getProjectAndProfileBySlug(supabase: SupabaseClient, slug: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, profiles!projects_creator_fkey(*)')
    .eq('slug', slug)
    .throwOnError()
  if (data === null) {
    return null
  }
  return data[0] as ProjectAndProfile
}

export async function getProjectAndProfileById(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, profiles!projects_creator_fkey(*)')
    .eq('id', id)
    .throwOnError()
  if (data === null) {
    return null
  }
  return data[0] as ProjectAndProfile
}

// This does not include project or round descriptions, for a smaller payload
export async function getFullProjectsByRound(supabase: SupabaseClient, roundTitle: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(
      'title, id, created_at, creator, slug, blurb, stage, funding_goal, min_funding, type, ai_fraction, quality_score, profiles!projects_creator_fkey(*), bids(*), txns(*), comments(*), rounds(title, slug), project_transfers(id, project_id, recipient_name, transferred, created_at), project_votes(magnitude), causes(title, slug)'
    )
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
    .eq('round', roundTitle)
  if (error) {
    throw error
  }
  // Scary type conversion!
  return data as unknown as FullProject[]
}

export async function getFullProjectsByCause(supabase: SupabaseClient, causeSlug: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(
      'title, id, created_at, creator, slug, blurb, stage, funding_goal, min_funding, type, amm_shares, founder_shares, auction_close, ai_fraction, quality_score, profiles!projects_creator_fkey(*), bids(*), txns(*), comments(*), rounds(title, slug), project_transfers(id, project_id, recipient_name, transferred, created_at), project_votes(magnitude), project_causes!inner(cause_slug), causes(title, slug)'
    )
    .eq('project_causes.cause_slug', causeSlug)
    .neq('stage', 'hidden')
    .neq('stage', 'draft')
  if (error) {
    throw error
  }
  return data as unknown as FullProject[]
}

export async function getProjectsPendingTransferByUser(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, project_transfers(id, project_id, recipient_name, transferred, created_at)')
    .eq('creator', userId)
  return (data as FullProject[])?.filter((project) => {
    const numTransfers = project.project_transfers
      ? project.project_transfers.filter((transfer) => !transfer.transferred).length
      : 0
    return numTransfers > 0
  }) as Project[]
}

export async function getProjectAndBidsById(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, bids(*)')
    .eq('id', projectId)
    .throwOnError()
  if (data === null) {
    return null
  }
  return data[0] as ProjectAndBids
}

export async function getProjectBidsAndFollowsById(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, bids(*), project_follows(follower_id), causes(cert_params)')
    .eq('id', projectId)
    .throwOnError()
  if (data === null) {
    return null
  }
  return data[0] as ProjectBidsAndFollows
}

export async function getUserProjectVote(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
) {
  const { data } = await supabase
    .from('project_votes')
    .select('*')
    .eq('project_id', projectId)
    .throwOnError()
  return data?.find((vote) => vote.voter_id === userId) as ProjectVote | null
}

export async function getSelectProjects(supabase: SupabaseClient, projectIds: string[]) {
  const { data: projects, error } = await supabase.from('projects').select('*').in('id', projectIds)
  if (error) {
    throw error
  }
  return projects
}

export async function getProjectWithCausesById(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, causes(slug)')
    .eq('id', projectId)
    .maybeSingle()
    .throwOnError()
  return data ? (data as ProjectWithCauses) : undefined
}

export async function getProjectWithCausesBySlug(supabase: SupabaseClient, projectSlug: string) {
  const { data } = await supabase
    .from('projects')
    .select('*, causes(slug)')
    .eq('slug', projectSlug)
    .maybeSingle()
    .throwOnError()
  return data ? (data as ProjectWithCauses) : undefined
}

export async function updateProjectStage(
  supabase: SupabaseClient,
  projectId: string,
  newStage: string
) {
  const { error } = await supabase
    .from('projects')
    .update({
      stage: newStage,
    })
    .eq('id', projectId)
  if (error) {
    console.error('update stage', error)
  }
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  projectUpdate: ProjectUpdate
) {
  const { error } = await supabase.from('projects').update(projectUpdate).eq('id', projectId)
  if (error) {
    console.error(error)
  }
}

export async function getFullSimilarProjects(
  supabase: SupabaseClient,
  projectId: string,
  count: number = 3
): Promise<FullProjectWithSimilarity[]> {
  const { data: similarProjects, error: initialError } = await supabase.rpc(
    'find_similar_projects',
    {
      project_id: projectId,
      match_count: count,
    }
  )

  if (initialError) {
    console.error('Error fetching similar projects:', initialError)
    return []
  }

  if (similarProjects.length === 0) {
    return []
  }

  const projectIds = similarProjects.map((p: any) => p.id)

  const { data, error } = await supabase
    .from('projects')
    .select(
      '*, profiles!projects_creator_fkey(*), bids(*), txns(*), comments(*), rounds(*), project_transfers(id, project_id, recipient_name, transferred, created_at), project_votes(*), project_follows(follower_id), causes(title, slug)'
    )
    .in('id', projectIds)
    .neq('stage', 'hidden')
    .neq('stage', 'draft')

  if (error || !data) {
    console.error('Error fetching full similar projects:', error)
    return []
  }

  const projectsWithSimilarity = data
    // Add similarity to each project
    .map((project) => {
      const similarity = similarProjects.find((p: any) => p.id === project.id)?.similarity || 0
      return { ...project, similarity }
    })
    // Exclude projects with zero or fewer net votes
    .filter((project) => countVotes(project) > 0)
    // Sort by similarity
    .sort((a, b) => b.similarity - a.similarity) as FullProjectWithSimilarity[]
  return projectsWithSimilarity
}
