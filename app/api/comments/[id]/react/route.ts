import { NextResponse } from 'next/server'
import { react } from '@/lib/comments/reactions'
import { getSignedIn } from '@/lib/comments/auth'

export const runtime = 'nodejs'

// POST /api/comments/:id/react  { reaction }  →  { reacted, tipped }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (typeof body?.reaction !== 'string') {
    return NextResponse.json({ error: 'reaction is required' }, { status: 400 })
  }
  const result = await react(me.profile, id, body.reaction)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ reacted: result.reacted, tipped: result.tipped })
}
