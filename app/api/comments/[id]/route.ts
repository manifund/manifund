import { NextResponse } from 'next/server'
import { edit, remove } from '@/lib/comments'
import { getSignedIn } from '@/lib/comments/auth'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

// PATCH /api/comments/:id  { content, note? }: the author edits, or a moderator with a note
// (history kept by the database)
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const result = await edit(me, id, body?.content, body?.note ?? null)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ comment: result.comment })
}

// DELETE /api/comments/:id  { reason }: a moderator removes a comment, with a public reason
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const result = await remove(me, id, body?.reason ?? null)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ ok: true })
}
