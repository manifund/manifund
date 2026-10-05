'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { Row } from '@/components/layout/row'
import { Button } from '@/components/button'
import type { Comment } from '@/db/comment'

// Inline editor for the author, or a moderator (who adds a public note). The text stays where it was
// (same size, no extra box); the card's bottom row becomes Cancel and Save.
export function CommentEdit(props: { comment: Comment; asModerator: boolean; onDone: () => void }) {
  const { comment, asModerator, onDone } = props
  const editor = useTextEditor(
    comment.content ?? '',
    undefined,
    undefined,
    '!p-0 !min-h-0 !border-0 !bg-transparent focus:!outline-none focus:ring-0 text-sm'
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const save = async () => {
    if (!editor?.getText().trim()) return
    setSaving(true)
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editor.getJSON(), note: asModerator ? note : undefined }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? 'Could not save')
      return
    }
    onDone()
    router.refresh()
  }
  return (
    <div>
      <div className="[&>div]:!min-h-0 [&>div]:!shadow-none">
        <TextEditor editor={editor} />
      </div>
      <Row className="mt-1 h-[30px] items-center justify-end gap-3">
        {asModerator && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Moderator's note (public)"
            maxLength={500}
            className="min-w-0 flex-1 rounded-md border-gray-200 px-2 py-1 text-xs focus:border-orange-400 focus:ring-0"
          />
        )}
        <button onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700">
          Cancel
        </button>
        <Button size="2xs" loading={saving} disabled={asModerator && !note.trim()} onClick={save}>
          Save
        </Button>
      </Row>
    </div>
  )
}
