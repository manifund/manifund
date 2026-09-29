import { NextResponse } from 'next/server'
import { edit, remove } from '@/lib/comments'
import { getSignedIn } from '@/lib/comments/auth'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

// PATCH /api/comments/:id  { content }: the author edits (history kept by the database)
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const result = await edit(me.profile, id, body?.content)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ comment: result.comment })
}

// DELETE /api/comments/:id  { reason? }: the author deletes, or an admin removes with a reason
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const result = await remove(me, id, body?.reason ?? null)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ ok: true })
}
