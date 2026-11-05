import { NextResponse } from 'next/server'
import { post } from '@/lib/comments'
import { parseTarget } from '@/lib/comments/targets'
import { getSignedIn } from '@/lib/comments/auth'

export const runtime = 'nodejs'

// POST /api/comments  { target: { project | profile_id | org_id }, content, type?, replyingTo? }
export async function POST(request: Request) {
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in to comment' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const target = parseTarget(body?.target)
  if (!target) return NextResponse.json({ error: 'unknown target' }, { status: 400 })

  const result = await post(
    me.profile,
    {
      target,
      content: body.content,
      type: body.type ?? null,
      replyingTo: body.replyingTo ?? null,
    },
    'user',
    me.admin
  )
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ comment: result.comment }, { status: 201 })
}
