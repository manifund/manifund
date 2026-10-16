import { NextResponse } from 'next/server'
import { getSignedInProfile } from '@/lib/comments/auth'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { follow, unfollow } from '@/lib/follows'

export const runtime = 'nodejs'

async function followedIdOf(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { followedId?: string }
  return body.followedId
}

// POST /api/follows { followedId }: follow someone (everything they do, F1).
export async function POST(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const followedId = await followedIdOf(request)
  if (!followedId) return NextResponse.json({ error: 'followedId needed' }, { status: 400 })
  const result = await follow(await createServerSupabaseClient(), me.id, followedId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/follows { followedId }: unfollow.
export async function DELETE(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const followedId = await followedIdOf(request)
  if (!followedId) return NextResponse.json({ error: 'followedId needed' }, { status: 400 })
  const result = await unfollow(await createServerSupabaseClient(), me.id, followedId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
