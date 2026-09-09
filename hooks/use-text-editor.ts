'use client'
import Link, { isAllowedUri } from '@tiptap/extension-link'
import { mergeAttributes, useEditor } from '@tiptap/react'
import clsx from 'clsx'
import Placeholder from '@tiptap/extension-placeholder'
import { noop } from 'es-toolkit'
import useLocalStorage from '@/hooks/use-local-storage'
import { TIPTAP_EXTENSIONS } from '@/components/editor'
import { useEffect, useState } from 'react'
import { useSupabase } from '@/db/supabase-provider'
import { handleImageOnPaste } from '@/components/editor/upload-extension'

export function useTextEditor(
  defaultContent: any = '',
  key?: string,
  placeholder?: string,
  className?: string
) {
  const { value: content, setValue: saveContent } = useLocalStorage(defaultContent, key)
  const [edited, setEdited] = useState(false)
  const { supabase } = useSupabase()
  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: clsx(
          proseClass('md'),
          'p-3 h-full bg-white border border-gray-300 rounded-md focus:outline-orange-500 min-h-[5em]',
          className
        ),
      },
    },
    onUpdate: !key
      ? noop
      : ({ editor }) => {
          setEdited(true)
          // Persist editor content to local storage on each keystroke
          saveContent(editor.getJSON())
        },
    extensions: [
      ...TIPTAP_EXTENSIONS,
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-gray-500 before:float-left before:h-0 cursor-text',
      }),
    ],
    content: key && content ? content : defaultContent,
  })
  // Update editor's content if 1) no edits yet and 2) there's sth in local storage
  useEffect(() => {
    if (!edited && key && content) {
      editor?.chain().setContent(content).run()
    }
  }, [content])

  handleImageOnPaste(editor, supabase)
  return editor
}

// From Manifold's editor
export const proseClass = (size: 'sm' | 'md' | 'lg') =>
  clsx(
    'prose leading-relaxed max-w-full',
    'prose-a:text-orange-600 prose-a:no-underline',
    size === 'sm' ? 'prose-sm' : 'text-md',
    size === 'sm' && 'prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-li:my-0',
    size === 'md' && 'prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-2',
    '[&>p]:prose-li:my-0',
    'text-gray-900 prose-blockquote:text-gray-600',
    'prose-a:font-light prose-blockquote:font-light font-light',
    'break-anywhere'
  )

export const DisplayLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    delete HTMLAttributes.class // Only use our classes (don't duplicate on paste)
    // Upstream Link strips disallowed URI schemes (javascript: etc.) in its
    // renderHTML; overriding it means we must re-apply that check ourselves.
    if (
      !this.options.isAllowedUri(HTMLAttributes.href, {
        defaultValidate: (url: string) => !!isAllowedUri(url, this.options.protocols),
        protocols: this.options.protocols,
        defaultProtocol: this.options.defaultProtocol,
      })
    ) {
      HTMLAttributes.href = ''
    }
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        class: 'text-orange-600 hover:underline font-normal',
      }),
      0,
    ]
  },
})
