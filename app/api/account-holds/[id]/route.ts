import { NextResponse } from 'next/server'
import { getSignedIn } from '@/lib/comments/auth'
import { resolveHold } from '@/lib/account-holds'

export const runtime = 'nodejs'

// POST /api/account-holds/:profileId  { action: 'clear' | 'ban' } (admins)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (body?.action !== 'clear' && body?.action !== 'ban') {
    return NextResponse.json({ error: 'action must be clear or ban' }, { status: 400 })
  }
  const result = await resolveHold(me, id, body.action)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json({ ok: true })
}
