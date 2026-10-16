import { NextResponse } from 'next/server'
import { loadEmailChoice, readStopToken, setEmailChoice } from '@/lib/notifications/settings'
import { emailChoice, isEmailChoice } from '@/lib/notifications/kinds'

export const runtime = 'nodejs'

// POST /api/notifications/stop?t=<signed token>: an optional email's "Unsubscribe" (N6): sets the person's one
// choice to never. Works without signing in: the signed token says whose. Mail apps' one-click unsubscribe
// (RFC 8058) posts here too. { undo: <choice> } puts back the choice the stop answered with. GET does nothing, so
// link scanners that open every link in an email can't turn anything off.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const body = (await request.json().catch(() => ({}))) as { t?: string; undo?: unknown }
  const parsed = await readStopToken(body.t ?? url.searchParams.get('t') ?? '')
  if (!parsed) return NextResponse.json({ error: 'invalid link' }, { status: 400 })
  if (body.undo !== undefined) {
    const back = isEmailChoice(body.undo) && body.undo !== 'never' ? body.undo : emailChoice(null)
    const { error } = await setEmailChoice(parsed.profileId, back)
    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ ok: true, choice: back })
  }
  const previous = emailChoice(await loadEmailChoice(parsed.profileId))
  const { error } = await setEmailChoice(parsed.profileId, 'never')
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true, choice: 'never', previous })
}
