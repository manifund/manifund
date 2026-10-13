import { NextResponse } from 'next/server'
import { getSignedInProfile } from '@/lib/comments/auth'
import { setEmailMode } from '@/lib/notifications/settings'
import { EMAIL_CHOICES, type EmailChoice } from '@/lib/notifications/groups'

export const runtime = 'nodejs'

// POST /api/notifications/settings { group, mode }: the signed-in person's email choice for one
// group, right away or weekly (N3, N4). Always-emailed groups and anything else are refused.
export async function POST(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const { group, mode } = (await request.json().catch(() => ({}))) as {
    group?: string
    mode?: EmailChoice
  }
  if (!group || !mode) return NextResponse.json({ error: 'group and mode needed' }, { status: 400 })
  if (!EMAIL_CHOICES.includes(mode))
    return NextResponse.json({ error: `${mode} isn't a choice` }, { status: 400 })
  const { error } = await setEmailMode(me.id, group, mode)
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
