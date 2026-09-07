import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/db/supabase-admin'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { isProd } from '@/db/env'
import { getOpenWithdrawalRequests, WithdrawalRequest } from '@/db/withdrawal-request'
import { syncWithdrawalRequest } from '@/utils/mercury-withdrawals'
import { hasMercuryKeys } from '@/utils/mercury'
import { sendDiscordAlert } from '@/utils/discord'

export const maxDuration = 300

const STUCK_APPROVAL_DAYS = 2
const RE_ALERT_DAYS = 3

// Advances every open withdrawal as far as Mercury lets it go. This poll -- not
// the webhook -- is the source of truth for status, because Mercury's approval
// requests carry no link to the transaction they eventually produce.
//
// Runs hourly from vercel.json. Also accepts ?requestId= so the withdrawal page
// can refresh one row when a grantee lands back on it.
async function handler(req: NextRequest) {
  if (!isProd()) return NextResponse.json('not prod')
  if (!hasMercuryKeys())
    return NextResponse.json({ error: 'Mercury not configured' }, { status: 503 })

  const requestId = new URL(req.url).searchParams.get('requestId')
  const supabaseAdmin = createAdminClient()
  let requests: WithdrawalRequest[]

  if (requestId) {
    // User-triggered: only ever their own row.
    const user = await getUser(await createServerSupabaseClient())
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    const { data } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .eq('profile_id', user.id)
      .maybeSingle()
      .throwOnError()
    requests = data ? [data as WithdrawalRequest] : []
  } else {
    const secret = process.env.CRON_SECRET
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    requests = await getOpenWithdrawalRequests(supabaseAdmin)
  }

  let advanced = 0
  for (const request of requests) {
    try {
      await syncWithdrawalRequest(supabaseAdmin, request)
      advanced++
    } catch (e) {
      console.error('mercury-sync failed for', request.id, e)
      await sendDiscordAlert(`⚠️ mercury-sync failed for withdrawal request ${request.id}: ${e}`)
    }
  }

  // Anything sitting in the approval queue this long means nobody has clicked
  // approve, and a lingering needs_manual row means the wire wasn't sent -- or
  // went out with a different amount, which the auto-match above can't see.
  // The grantee can't fix either, so alert us rather than emailing them.
  //
  // Throttled on last_nudged_at, shared with mercury-nudge. Safe to reuse: that
  // cron only ever touches 'awaiting_recipient' rows and this only fires on
  // 'pending_approval' and 'needs_manual', so the two can never write to the
  // same row.
  if (!requestId) {
    const now = Date.now()
    const stuckCutoff = new Date(now - STUCK_APPROVAL_DAYS * 86400 * 1000).toISOString()
    const reAlertCutoff = new Date(now - RE_ALERT_DAYS * 86400 * 1000).toISOString()
    const stuck = requests.filter(
      (r) =>
        (r.status === 'pending_approval' || r.status === 'needs_manual') &&
        (r.submitted_at ?? r.requested_at) < stuckCutoff &&
        (!r.last_nudged_at || r.last_nudged_at < reAlertCutoff)
    )
    for (const r of stuck) {
      await sendDiscordAlert(
        r.status === 'pending_approval'
          ? `⚠️ Withdrawal awaiting approval in Mercury for ${STUCK_APPROVAL_DAYS}+ days: ` +
              `$${r.amount} (request ${r.id})`
          : `⚠️ Manual wire still open after ${STUCK_APPROVAL_DAYS}+ days: ` +
              `$${r.amount} (request ${r.id}). If it already went out, the sync couldn't ` +
              `match it — set status='sent' and sent_at in SQL and email the grantee.`
      )
      await supabaseAdmin
        .from('withdrawal_requests')
        .update({ last_nudged_at: new Date().toISOString() })
        .eq('id', r.id)
        .throwOnError()
    }
  }

  return NextResponse.json({ checked: requests.length, advanced })
}

// Cron hits GET; the withdrawal page refreshes one row via POST.
export { handler as GET, handler as POST }
