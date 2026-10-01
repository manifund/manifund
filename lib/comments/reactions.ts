import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/db/supabase-admin'
import { getTxnAndProjectsByUser } from '@/db/txn'
import { getPendingBidsByUser } from '@/db/bid'
import { calculateCharityBalance } from '@/utils/math'
import { sendTemplateEmail, TEMPLATE_IDS } from '@/utils/email'
import type { Profile } from '@/db/profile'
import { freeRxns, tippedRxns } from './reaction-list'
import { log } from '@/lib/log'
import { commentHref, TARGET_EMBEDS, type TargetEmbeds } from './links'
import { denied, type Result } from './types'

// Reactions (C35): emoji on comments, once per emoji per person. Free ones toggle (reacting again
// takes it back). Tipped ones move charity money to the commenter, exactly once: the reaction and
// the money are written together by tip_comment, which charges nothing when the tip was already
// given (a double click, a repeated request). A tip can't be taken back.
export async function react(
  reactor: Profile,
  commentId: string,
  reaction: string
): Promise<Result<{ reacted: boolean; tipped: boolean }>> {
  const price = tippedRxns[reaction] ?? 0
  if (!price && !freeRxns.includes(reaction)) return denied(400, 'unknown reaction')

  const admin = createAdminClient()
  const { data: comment } = await admin
    .from('comments')
    .select(`id, commenter, deleted_at, ${TARGET_EMBEDS}`)
    .eq('id', commentId)
    .maybeSingle()
    .throwOnError()
  if (!comment || comment.deleted_at) return denied(404, 'comment not found')

  const key = { comment_id: commentId, reactor_id: reactor.id, reaction }
  if (!price) {
    const { data: removed } = await admin
      .from('comment_rxns')
      .delete()
      .match(key)
      .select()
      .throwOnError()
    if (removed?.length) return { ok: true, reacted: false, tipped: false }
    await admin.from('comment_rxns').upsert(key, { ignoreDuplicates: true }).throwOnError()
    return { ok: true, reacted: true, tipped: false }
  }

  // The balance is checked here; tip_comment then charges at most once per tip.
  const [txns, bids] = await Promise.all([
    getTxnAndProjectsByUser(admin, reactor.id),
    getPendingBidsByUser(admin, reactor.id),
  ])
  const balance = calculateCharityBalance(txns, bids, reactor.id, reactor.accreditation_status)
  if (balance < price) {
    return denied(400, `Not enough in your charity balance for a $${price} tip.`)
  }
  const { data: txnId, error } = await admin.rpc('tip_comment', {
    p_comment_id: commentId,
    p_tipper: reactor.id,
    p_reaction: reaction,
    p_amount: price,
  })
  if (error) {
    log.error('comment.tip_failed', { comment_id: commentId, tipper: reactor.id, error })
    return denied(500, 'could not send the tip')
  }
  if (!txnId) return { ok: true, reacted: true, tipped: false } // already given: nothing charged

  log.info('comment.tipped', { comment_id: commentId, tipper: reactor.id, amount: price })
  const href = commentHref(comment as { id: string } & TargetEmbeds)
  after(() =>
    sendTemplateEmail(
      TEMPLATE_IDS.GENERIC_NOTIF,
      {
        subject: `You received a $${price} tip for your comment on Manifund`,
        notifText: `${reactor.full_name} tipped you $${price} for a comment you made on Manifund, which you can now pass on to the charity or project of your choice. Thanks for your contribution to the discussion!`,
        buttonUrl: `https://manifund.org${href}`,
        buttonText: 'View comment',
      },
      comment.commenter
    ).catch((e) => log.error('comment.tip_email_failed', { comment_id: commentId, error: e }))
  )
  return { ok: true, reacted: true, tipped: true }
}
