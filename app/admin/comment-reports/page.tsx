import Link from 'next/link'
import { createAdminClient } from '@/db/supabase-admin'
import { RelativeTime } from '@/components/relative-time'
import { commentHref, targetTitle, TARGET_EMBEDS } from '@/lib/comments/links'
import { ResolveReport, ClampedContent } from './resolve-report'
import { requireAdmin } from '@/lib/require-admin'
import { categoryText } from '@/utils/moderation-labels'

export const dynamic = 'force-dynamic'

// Open reports, one card per reported comment. Admins only: checked here, before the query (the
// layout's check doesn't stop the page from rendering).
export default async function CommentReportsPage() {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('comment_reports')
    .select(
      `id, is_spam, note, created_at, source, categories, reporter:profiles!comment_reports_reporter_id_fkey(username), comment:comments(id, content, created_at, deleted_at, held_at, held_categories, author:profiles!comments_commenter_fkey(username, full_name), ${TARGET_EMBEDS})`
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: true })
    .throwOnError()
  const byComment = new Map<string, any[]>()
  for (const r of (data ?? []) as any[]) {
    byComment.set(r.comment.id, [...(byComment.get(r.comment.id) ?? []), r])
  }
  // Words moved aside for a doxxing hold (C40), so admins can judge them.
  const { data: moved } = await createAdminClient()
    .from('held_comment_content')
    .select('comment_id, content')
    .in('comment_id', [...byComment.keys()])
    .throwOnError()
  const movedContent = new Map((moved ?? []).map((m) => [m.comment_id, m.content]))

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-xl font-medium">Comment review</h2>
      {byComment.size === 0 && <p className="text-sm text-gray-500">No open reports.</p>}
      <div className="flex flex-col gap-4">
        {[...byComment.values()].map((reports) => {
          const c = reports[0].comment
          return (
            <div key={c.id} className="rounded-lg bg-white p-4 shadow">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{c.author?.full_name || c.author?.username}</span>
                <span className="text-gray-500">on</span>
                <Link href={commentHref(c)} className="text-orange-600 hover:underline">
                  {targetTitle(c)}
                </Link>
                <RelativeTime date={c.created_at} className="text-xs text-gray-400" />
                {c.held_at && !c.deleted_at && (
                  <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                    hidden pending review: {categoryText(c.held_categories)}
                  </span>
                )}
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-2">
                {c.deleted_at ? (
                  <p className="text-sm italic text-gray-500">Already removed</p>
                ) : (
                  <ClampedContent content={movedContent.get(c.id) ?? c.content} />
                )}
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {reports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-gray-500">
                      {r.source === 'ai' ? 'AI moderator' : `Reported by @${r.reporter?.username}`}
                    </span>
                    {r.source === 'ai' && (
                      <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                        {categoryText(r.categories)}
                      </span>
                    )}
                    {r.note ? (
                      <span className="text-gray-900">&ldquo;{r.note}&rdquo;</span>
                    ) : (
                      !r.is_spam && <span className="italic text-gray-400">no reason given</span>
                    )}
                    {r.is_spam && r.source !== 'ai' && (
                      <span className="rounded-full bg-rose-100 px-2 text-xs text-rose-700">
                        spam
                      </span>
                    )}
                    <RelativeTime date={r.created_at} className="text-xs text-gray-400" />
                  </li>
                ))}
              </ul>
              <ResolveReport
                commentId={c.id}
                reportCount={reports.length}
                alreadyRemoved={!!c.deleted_at}
                held={!!c.held_at && !c.deleted_at}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
