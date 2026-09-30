'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { Button } from '@/components/button'
import type { Comment } from '@/db/comment'

// Inline editor for the author, or a moderator (who adds a note). Saving keeps the old version
// in the public history.
export function CommentEdit(props: { comment: Comment; asModerator: boolean; onDone: () => void }) {
  const { comment, asModerator, onDone } = props
  const editor = useTextEditor(comment.content ?? '')
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
    <div className="flex flex-col gap-2">
      <TextEditor editor={editor} />
      {asModerator && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Moderator's note (public), e.g. removed an email address"
          maxLength={500}
          className="w-full rounded-md border-gray-300 text-sm focus:border-orange-500 focus:ring-orange-500"
        />
      )}
      <p className="text-xs text-gray-500">
        Earlier versions stay visible to everyone.
        {!asModerator && ' To retract something, strike it through (select it, then S).'}
      </p>
      <div className="flex justify-end gap-2">
        <Button color="gray" size="xs" onClick={onDone}>
          Cancel
        </Button>
        <Button size="xs" loading={saving} disabled={asModerator && !note.trim()} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  )
}
