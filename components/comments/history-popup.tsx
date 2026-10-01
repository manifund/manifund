'use client'
import { useState } from 'react'
import { Modal } from '@/components/modal'
import { RichContent } from '@/components/editor'
import { RelativeTime } from '@/components/relative-time'
import { createClient } from '@/db/supabase-browser'
import type { Comment } from '@/db/comment'

type Version = { key: string; content: any; writtenAt: string; label: string; modNote?: string }

// "edited" marker; opens every version of the comment, newest first (whole versions, no diff:
// decided 2026-09-28). The history of a removed comment isn't readable by the public.
export function HistoryPopup(props: { comment: Comment }) {
  const { comment } = props
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const byModerator = !!comment.edited_by && comment.edited_by !== comment.commenter

  const load = async () => {
    setOpen(true)
    const { data } = await createClient()
      .from('comment_revisions')
      .select('id, content, written_at, written_by, note')
      .eq('comment_id', comment.id)
      .order('written_at', { ascending: false })
    const past = (data ?? []).map((r, i, all) => ({
      key: r.id,
      content: r.content,
      writtenAt: r.written_at,
      label: i === all.length - 1 ? 'Original' : `Version ${all.length - i}`,
      // A version written by someone other than the author is a moderator's edit.
      modNote: r.written_by && r.written_by !== comment.commenter ? (r.note ?? '') : undefined,
    }))
    setVersions([
      {
        key: 'current',
        content: comment.content,
        writtenAt: comment.edited_at!,
        label: 'Current',
        modNote: byModerator ? (comment.edit_note ?? '') : undefined,
      },
      ...past,
    ])
  }

  return (
    <>
      <button
        onClick={load}
        className="text-xs text-gray-400 underline decoration-dotted hover:text-gray-600"
        title="See every version of this comment"
      >
        {byModerator ? 'edited by a moderator' : 'edited'}
      </button>
      <Modal open={open} setOpen={setOpen}>
        <h2 className="mb-1 text-lg font-medium">Edit history</h2>
        {!versions && <p className="text-sm text-gray-500">Loading…</p>}
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {versions?.map((v) => (
            <div key={v.key} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{v.label}</span>
                <RelativeTime date={v.writtenAt} />
              </div>
              {v.modNote !== undefined && (
                <p className="mb-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Moderator&apos;s edit{v.modNote ? `: ${v.modNote}` : ''}
                </p>
              )}
              <RichContent content={v.content} className="text-sm" />
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
