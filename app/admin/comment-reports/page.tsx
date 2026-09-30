import Link from 'next/link'
import { createAdminClient } from '@/db/supabase-admin'
import { RichContent } from '@/components/editor'
import { RelativeTime } from '@/components/relative-time'
import { commentHref, targetTitle, TARGET_EMBEDS } from '@/lib/comments/links'
import { ResolveReport } from './resolve-report'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

// Open reports, one card per reported comment. Admins only: checked here, before the query (the
// layout's check doesn't stop the page from rendering).
export default async function CommentReportsPage() {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('comment_reports')
    .select(
      `id, is_spam, note, created_at, reporter:profiles!comment_reports_reporter_id_fkey(username), comment:comments(id, content, created_at, deleted_at, author:profiles!comments_commenter_fkey(username, full_name), ${TARGET_EMBEDS})`
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: true })
    .throwOnError()
  const byComment = new Map<string, any[]>()
  for (const r of (data ?? []) as any[]) {
    byComment.set(r.comment.id, [...(byComment.get(r.comment.id) ?? []), r])
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-1 text-xl font-medium">Reported comments</h2>
      <p className="mb-4 text-sm text-gray-500">
        {byComment.size} comment(s) with open reports. Removing leaves a public placeholder with
        your reason; the text stays in the admin-only history.
      </p>
      <div className="flex flex-col gap-4">
        {[...byComment.values()].map((reports) => {
          const c = reports[0].comment
          const spam = reports.filter((r) => r.is_spam).length
          return (
            <div key={c.id} className="rounded-lg bg-white p-4 shadow">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{c.author?.full_name || c.author?.username}</span>
                <span className="text-gray-500">on</span>
                <Link href={commentHref(c)} className="text-orange-600 hover:underline">
                  {targetTitle(c)}
                </Link>
                <RelativeTime date={c.created_at} className="text-xs text-gray-400" />
                <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                  {reports.length} report(s){spam ? `, ${spam} spam` : ''}
                </span>
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-2">
                {c.deleted_at ? (
                  <p className="text-sm italic text-gray-500">Already removed</p>
                ) : (
                  <RichContent content={c.content} className="text-sm" />
                )}
              </div>
              <ul className="mt-2 text-xs text-gray-600">
                {reports.map((r) => (
                  <li key={r.id}>
                    @{r.reporter?.username}
                    {r.is_spam ? ' (spam)' : ''}
                    {r.note ? `: ${r.note}` : ''} · <RelativeTime date={r.created_at} />
                  </li>
                ))}
              </ul>
              <ResolveReport commentId={c.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
