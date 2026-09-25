import { NextRequest, NextResponse } from 'next/server'
import { getUserAndClient } from '@/db/edge'
import { JSONContent } from '@tiptap/react'
import { sendComment, Comment } from '@/db/comment'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

type CommentProps = {
  content: JSONContent
  projectId: string
  specialType: Comment['special_type']
  replyingTo?: string
}

export default async function handler(req: NextRequest) {
  const { content, projectId, replyingTo, specialType } = (await req.json()) as CommentProps
  const { supabase, user } = await getUserAndClient(req)
  if (!user) return NextResponse.error()
  if (replyingTo) {
    const { data: parent } = await supabase
      .from('comments')
      .select('project, replying_to')
      .eq('id', replyingTo)
      .single()
    if (!parent || parent.replying_to !== null || parent.project !== projectId) {
      return NextResponse.json(
        { error: 'replyingTo must refer to a root comment in the same project.' },
        { status: 400 }
      )
    }
  }
  await sendComment(supabase, content, projectId, user.id, replyingTo, specialType)
  const { error } = await supabase.rpc('follow_project', {
    project_id: projectId,
    follower_id: user.id,
  })
  if (error) {
    console.error(error)
    return NextResponse.error()
  }
  return NextResponse.json('success')
}
