import { after, NextResponse } from 'next/server'
import { getSignedIn } from '@/lib/comments/auth'
import { checkAccount } from '@/lib/account-holds'

export const runtime = 'nodejs'

// POST /api/account-check: the profile form calls this after a save, so a rename is checked now
// rather than at the next post (U3). Posting re-checks anyway, so a skipped call changes nothing.
export async function POST() {
  const me = await getSignedIn()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  after(() => checkAccount(me.profile, me.admin).catch((e) => console.error('account check failed:', e)))
  return NextResponse.json({ ok: true }, { status: 202 })
}
