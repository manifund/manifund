'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { Row } from '@/components/layout/row'
import { Button } from '@/components/button'
import type { Comment } from '@/db/comment'

// Inline editor for the author, or a moderator (who adds a public note). Laid out like the comment
// box: the text, then a bar with Cancel on the left and Save on the right.
export function CommentEdit(props: { comment: Comment; asModerator: boolean; onDone: () => void }) {
  const { comment, asModerator, onDone } = props
  const editor = useTextEditor(
    comment.content ?? '',
    undefined,
    undefined,
    'border-0 focus:!outline-none focus:ring-0 text-sm'
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
    <div className="-mx-2 overflow-hidden rounded-lg ring-1 ring-gray-200 focus-within:ring-orange-400">
      <TextEditor editor={editor} />
      {asModerator && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Moderator's note (public)"
          maxLength={500}
          className="w-full border-0 border-t border-gray-100 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:ring-0"
        />
      )}
      <Row className="items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-1">
        <button onClick={onDone} className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
        <Button size="xs" loading={saving} disabled={asModerator && !note.trim()} onClick={save}>
          Save
        </Button>
      </Row>
    </div>
  )
}
