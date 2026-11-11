import { SupabaseClient } from '@supabase/supabase-js'
import { getFundAdmins } from '@/db/fund'
import { escapeHtml } from '@/utils/email'
import { formatMoney } from '@/utils/formatting'
import { log } from '@/lib/log'
import { notificationEmail, notifyMany } from './notify'

// F9: tells each of a fund's admins that someone donated to it. Never throws: the donation has already happened.
export async function notifyFundAdmins(
  supabase: SupabaseClient,
  fund: { id: string; username: string; full_name: string },
  donorName: string,
  amount: number,
  txnId?: string
) {
  try {
    const admins = await getFundAdmins(supabase, fund.id)
    const line = `${donorName} donated ${formatMoney(amount)} to ${fund.full_name}`
    await notifyMany(
      admins.map((admin) => ({
        to: admin.id,
        reason: 'donation_to_your_fund' as const,
        actorId: fund.id,
        txnId,
        amount,
        email: notificationEmail(admin.id, {
          subject: line,
          heading: line,
          htmlContent: `<p>${escapeHtml(line)}. It's now part of what the fund can grant.</p>`,
          textContent: `${line}. It's now part of what the fund can grant.`,
          button: {
            url: `https://manifund.org/${fund.username}?tab=donations`,
            text: 'See donations',
          },
        }),
      }))
    )
  } catch (e) {
    log.error('notifications.fund_donation_failed', { fund_id: fund.id, error: e })
  }
}
