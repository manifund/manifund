import { NextResponse } from 'next/server'
import { report } from '@/lib/comments'
import { getSignedIn } from '@/lib/comments/auth'

export const runtime = 'nodejs'

// POST /api/comments/:id/report  { isSpam?, note? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const result = await report(me.profile, id, { isSpam: !!body?.isSpam, note: body?.note ?? null })
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ ok: true }, { status: 201 })
}
