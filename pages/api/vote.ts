import { NextRequest, NextResponse } from 'next/server'
import { getUserAndClient } from '@/db/edge'
import { getUserProjectVote } from '@/db/project'

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
  if (oldVote) {
    await supabase.from('project_votes').update({ magnitude: newMagnitude }).eq('id', oldVote.id)
  } else {
    await supabase
      .from('project_votes')
      .insert([{ project_id: projectId, voter_id: user.id, magnitude: newMagnitude }])
  }
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
