import { NextResponse } from 'next/server'
import { getSignedInProfile } from '@/lib/comments/auth'
import { setEmailChoice } from '@/lib/notifications/settings'
import { isEmailChoice } from '@/lib/notifications/kinds'

export const runtime = 'nodejs'

// POST /api/notifications/settings { choice }: the signed-in person's one email choice for optional notifications:
// immediate, daily or never (N4). Anything else is refused.
export async function POST(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const { choice } = (await request.json().catch(() => ({}))) as { choice?: unknown }
  if (!isEmailChoice(choice))
    return NextResponse.json({ error: 'choice must be immediate, daily or never' }, { status: 400 })
  const { error } = await setEmailChoice(me.id, choice)
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
