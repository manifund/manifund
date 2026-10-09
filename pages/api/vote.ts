import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getUserAndClient } from '@/db/edge'
import { getUserProjectVote } from '@/db/project'
import { karmaWeight } from '@/utils/karma'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

type VoteProps = {
  projectId: string
  newMagnitude: number
}

export default async function handler(req: NextRequest) {
  const { projectId, newMagnitude } = (await req.json()) as VoteProps
  const { supabase, user } = await getUserAndClient(req)
  if (!user) {
    return NextResponse.error()
  }
  if (![-1, 0, 1].includes(newMagnitude)) {
    return NextResponse.error()
  }
  const oldVote = await getUserProjectVote(supabase, projectId, user.id)
  const oldMagnitude = oldVote?.magnitude ?? 0
  if (oldVote) {
    await supabase.from('project_votes').update({ magnitude: newMagnitude }).eq('id', oldVote.id)
  } else {
    await supabase
      .from('project_votes')
      .insert([{ project_id: projectId, voter_id: user.id, magnitude: newMagnitude }])
  }
  await applyVoteKarmaDelta(projectId, user.id, newMagnitude - oldMagnitude)
  if (newMagnitude === 1) {
    const { error } = await supabase.rpc('follow_project', {
      project_id: projectId,
      follower_id: user.id,
    })
    if (error) {
      console.error(error)
      return NextResponse.error()
    }
  }
  return NextResponse.json('voted!')
}

// Nudge the project's and creator's karma by this vote's weight now; the hourly
// recompute (utils/karma.ts) rewrites every row, so any drift is corrected there.
async function applyVoteKarmaDelta(projectId: string, voterId: string, magnitudeDelta: number) {
  if (magnitudeDelta === 0) return
  const admin = createAdminClient()
  const [{ data: voter }, { data: project }] = await Promise.all([
    admin.from('profiles').select('karma').eq('id', voterId).single(),
    admin.from('projects').select('creator').eq('id', projectId).single(),
  ])
  if (!voter || !project || project.creator === voterId) return
  const delta = magnitudeDelta * karmaWeight(voter.karma)
  if (delta === 0) return
  const { error } = await admin.rpc('adjust_karma', {
    project_id: projectId,
    project_delta: delta,
    profile_id: project.creator,
    profile_delta: delta,
  })
  if (error) console.error('adjust_karma failed:', error)
}
