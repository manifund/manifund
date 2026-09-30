import { NextResponse } from 'next/server'
import { resolveReports } from '@/lib/comments'
import { getSignedIn } from '@/lib/comments/auth'

export const runtime = 'nodejs'

// POST /api/comments/:id/resolve  { resolution: 'dismissed' | 'removed', reason?, closeReports? } (admins)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (body?.resolution !== 'dismissed' && body?.resolution !== 'removed') {
    return NextResponse.json({ error: 'resolution must be dismissed or removed' }, { status: 400 })
  }
  const result = await resolveReports(
    me,
    id,
    body.resolution,
    body.reason ?? null,
    body.closeReports !== false
  )
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ ok: true })
}
