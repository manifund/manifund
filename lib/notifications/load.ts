import 'server-only'
import { createAdminClient } from '@/db/supabase-admin'
import { toPlaintext } from '@/utils/tiptap-parsing'
import { commentHref, targetTitle, TARGET_EMBEDS } from '@/lib/comments/links'
import type { NotificationRow } from './describe'

const SELECT = `id, recipient_id, reason, created_at, read_at, amount,
  actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url),
  project:projects(title, slug, approved),
  withdrawal:withdrawal_requests(status),
  saved_search:saved_searches(name),
  comment:comments(id, content, ${TARGET_EMBEDS})`

// Notification rows with what the inbox and the weekly summary show (describe.ts). Server-only:
// callers filter to one recipient (the inbox) or to rows waiting for the summary.
export async function loadNotifications(filter: {
  recipientId?: string
  digestBefore?: string
  limit?: number
}): Promise<(NotificationRow & { recipient_id: string })[]> {
  let query = (createAdminClient() as any)
    .from('notifications')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100)
  if (filter.recipientId) query = query.eq('recipient_id', filter.recipientId)
  if (filter.digestBefore)
    query = query.eq('email_status', 'digest').lte('created_at', filter.digestBefore)
  const { data } = await query.throwOnError()
  return ((data ?? []) as any[]).map((n) => ({
    ...n,
    commentHref: n.comment ? commentHref(n.comment) : undefined,
    commentTitle: n.comment ? targetTitle(n.comment) : undefined,
    excerpt: n.comment?.content ? toPlaintext(n.comment.content).slice(0, 160) : undefined,
    searchName: n.saved_search?.name ?? undefined,
  }))
}
