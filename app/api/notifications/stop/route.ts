import { NextResponse } from 'next/server'
import { readStopToken, setEmailMode } from '@/lib/notifications/settings'
import { groupByKey, type NotificationGroup } from '@/lib/notifications/groups'

export const runtime = 'nodejs'

// POST /api/notifications/stop?t=<signed token>: an email's "Unsubscribe from these emails" (N7): turns off email
// for the groups the email was about (one, or each kind a weekly summary listed). Works without signing in: the
// signed token says whose emails and which groups. Mail apps' one-click unsubscribe (RFC 8058) posts here too.
// { undo: true } restores the groups' defaults. GET does nothing, so link scanners that open every link in an
// email can't turn anything off.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const body = (await request.json().catch(() => ({}))) as { t?: string; undo?: boolean }
  const token = body.t ?? url.searchParams.get('t') ?? ''
  const parsed = await readStopToken(token)
  const groups = parsed?.groupKeys.map(groupByKey) ?? []
  if (!parsed || !groups.length || groups.some((g) => !g))
    return NextResponse.json({ error: 'invalid link' }, { status: 400 })
  const valid = groups as NotificationGroup[]
  if (valid.some((g) => g.always)) {
    return NextResponse.json({ error: 'these emails are always sent' }, { status: 400 })
  }
  for (const group of valid) {
    const { error } = await setEmailMode(
      parsed.profileId,
      group.key,
      body.undo ? group.default : 'off'
    )
    if (error) return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, labels: valid.map((g) => g.label), stopped: !body.undo })
}
