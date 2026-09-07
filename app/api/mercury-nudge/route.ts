import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/db/supabase-admin'
import { isProd } from '@/db/env'
import { WithdrawalRequest } from '@/db/withdrawal-request'
import { getUserEmail, sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'

export const maxDuration = 300

const NUDGE_AFTER_HOURS = 24
const RENUDGE_AFTER_DAYS = 3

// A grantee can request a withdrawal, get handed to Mercury, and never enter
// their bank details -- leaving their balance debited and nothing happening
// until the invite expires. This is the flow's most likely new failure mode, so
// chase it daily. The 24h delay plus 3-day spacing caps this at ~4 emails
// before the invite expiry reverses the request, so no counter column is needed.
//
// last_nudged_at is shared with mercury-sync's stuck-approval alert. They can't
// collide: this only touches 'awaiting_recipient' rows, that only 'pending_approval'.
export async function GET(req: NextRequest) {
  if (!isProd()) return NextResponse.json('not prod')
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const supabaseAdmin = createAdminClient()
  const { data } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('*')
    .eq('status', 'awaiting_recipient')
    .lt('requested_at', new Date(now - NUDGE_AFTER_HOURS * 3600 * 1000).toISOString())
    .throwOnError()

  const renudgeCutoff = new Date(now - RENUDGE_AFTER_DAYS * 86400 * 1000).toISOString()
  const due = ((data ?? []) as WithdrawalRequest[]).filter(
    (r) => !r.last_nudged_at || r.last_nudged_at < renudgeCutoff
  )

  let nudged = 0
  for (const request of due) {
    const email = await getUserEmail(supabaseAdmin, request.profile_id)
    if (!email) continue
    await sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        notifText:
          `You asked to withdraw $${Number(request.amount).toLocaleString()} from Manifund, but we still ` +
          `need your bank details before we can send it. Your money is safe and being held in the ` +
          `meantime — it only takes a minute to finish.`,
        buttonUrl: 'https://manifund.org/withdraw/request',
        buttonText: 'Finish your withdrawal',
        subject: 'Manifund: finish your withdrawal',
      },
      undefined,
      email
    )
    await supabaseAdmin
      .from('withdrawal_requests')
      .update({ last_nudged_at: new Date().toISOString() })
      .eq('id', request.id)
      .throwOnError()
    nudged++
  }

  return NextResponse.json({ candidates: due.length, nudged })
}
