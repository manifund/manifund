'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { TextEditor } from '@/components/editor'
import { useTextEditor } from '@/hooks/use-text-editor'
import { Button } from '@/components/button'
import type { Comment } from '@/db/comment'

// Inline editor for the author. Saving keeps the old version in the history.
export function CommentEdit(props: { comment: Comment; onDone: () => void }) {
  const { comment, onDone } = props
  const editor = useTextEditor(comment.content ?? '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const save = async () => {
    if (!editor?.getText().trim()) return
    setSaving(true)
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editor.getJSON() }),
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
      <p className="text-xs text-gray-500">Earlier versions stay visible to everyone.</p>
      <div className="flex justify-end gap-2">
        <Button color="gray" size="xs" onClick={onDone}>
          Cancel
        </Button>
        <Button size="xs" loading={saving} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  )
}
