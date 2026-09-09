import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/db/edge'
import { isAuthorizedCron } from '@/utils/cron-auth'
import { isProd } from '@/db/env'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import { computeIdleBalances } from '@/utils/idle-balances'

export const config = {
  runtime: 'edge',
  regions: ['sfo1'],
}

// Quarterly nudge (see vercel.json) to holders of long-idle withdrawable balances,
// so the money isn't forgotten. Recomputed each run; summary goes to the team.
const MONTHS = 12
const THRESHOLD = 5_000
const SUMMARY_EMAILS = ['austin@manifund.org', 'carol@manifund.org']

export default async function handler(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isProd()) {
    return NextResponse.json('not prod')
  }
  const supabase = createAdminClient()
  const idle = await computeIdleBalances(supabase, MONTHS, THRESHOLD)

  for (const holder of idle) {
    const amount = Math.floor(holder.aged)
    await sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        notifText: `You're receiving this email because you've had a withdrawable balance of $${amount.toLocaleString(
          'en-US'
        )} on Manifund for at least a year. Of course, you're welcome to leave it on the platform, but just flagging to make sure the money hasn't been forgotten. Thank you!`,
        buttonUrl: `https://manifund.org/${holder.username}`,
        buttonText: 'View your balance',
        subject: 'Your Manifund balance',
      },
      holder.userId
    )
  }

  const summary = idle
    .map((h) => `${h.full_name} (@${h.username}): $${Math.floor(h.aged).toLocaleString('en-US')}`)
    .join('; ')
  for (const summaryEmail of SUMMARY_EMAILS) {
    await sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        notifText: idle.length
          ? `Quarterly idle-balance emails sent to ${idle.length} ${
              idle.length === 1 ? 'person' : 'people'
            } with a withdrawable balance of $${THRESHOLD.toLocaleString(
              'en-US'
            )}+ held for ${MONTHS}+ months: ${summary}`
          : `Quarterly idle-balance check ran: no one currently holds a withdrawable balance of $${THRESHOLD.toLocaleString(
              'en-US'
            )}+ for ${MONTHS}+ months, so no emails were sent.`,
        buttonUrl: 'https://manifund.org',
        buttonText: 'Manifund',
        subject: `Idle balance emails sent: ${idle.length}`,
      },
      undefined,
      summaryEmail
    )
  }

  return NextResponse.json({ emailed: idle.length })
}
