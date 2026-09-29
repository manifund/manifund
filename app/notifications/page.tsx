import Link from 'next/link'
import clsx from 'clsx'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { getUser } from '@/db/profile'
import { Avatar } from '@/components/avatar'
import { RelativeTime } from '@/components/relative-time'
import { toPlaintext } from '@/utils/tiptap-parsing'
import { commentHref, targetTitle, TARGET_EMBEDS } from '@/lib/comments/links'
import { MarkRead } from './mark-read'

const WHAT: Record<string, string> = {
  reply_to_you: 'replied to you on',
  mention: 'mentioned you on',
  comment_on_your_project: 'commented on your project',
  comment_on_your_profile: 'commented on your profile',
  progress_update: 'posted a progress update on',
  final_report: 'posted a final report on',
  followed_project_comment: 'commented on',
}

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getUser(supabase)
  if (!user) redirect('/login')
  const { data } = await supabase
    .from('notifications')
    .select(
      `id, reason, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url), comment:comments(id, content, ${TARGET_EMBEDS})`
    )
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
    .throwOnError()
  const rows = (data ?? []) as any[]
  const unread = rows.filter((r) => !r.read_at).length

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-medium">Notifications</h1>
      <p className="mb-4 text-sm text-gray-500">
        {unread ? `${unread} new` : 'Nothing new'} · comments on your projects and profile, replies
        and mentions
      </p>
      {unread > 0 && <MarkRead />}
      {rows.length === 0 && <p className="text-sm italic text-gray-500">No notifications yet.</p>}
      <ul className="divide-y divide-gray-200 rounded-lg bg-white shadow">
        {rows.map((n) => {
          const excerpt = n.comment?.content ? toPlaintext(n.comment.content).slice(0, 160) : ''
          return (
            <li key={n.id} className={clsx('p-3', !n.read_at && 'bg-orange-50')}>
              <Link href={n.comment ? commentHref(n.comment) : '#'} className="flex gap-3">
                {n.actor && (
                  <Avatar
                    username={n.actor.username}
                    avatarUrl={n.actor.avatar_url}
                    id={n.actor.id}
                    size="sm"
                    noLink
                  />
                )}
                <div className="min-w-0 text-sm">
                  <p>
                    <span className="font-medium">{n.actor?.full_name || n.actor?.username}</span>{' '}
                    {WHAT[n.reason] ?? 'commented on'}{' '}
                    {n.reason !== 'comment_on_your_profile' && (
                      <span className="font-medium">{n.comment ? targetTitle(n.comment) : ''}</span>
                    )}
                  </p>
                  {excerpt && <p className="truncate text-gray-500">{excerpt}</p>}
                  <RelativeTime date={n.created_at} className="text-xs text-gray-400" />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
