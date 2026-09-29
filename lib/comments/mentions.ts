import type { SupabaseClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/core'

// Show mentions with the person's current username: a mention stores the username it was written
// with (attrs.label) next to the user id (attrs.id). One query per page of comments.
export async function withCurrentMentionLabels<T extends { content: unknown }>(
  supabase: SupabaseClient,
  comments: T[]
): Promise<T[]> {
  const ids = new Set<string>()
  const walk = (node: JSONContent, fn: (n: JSONContent) => void) => {
    fn(node)
    node.content?.forEach((c) => walk(c, fn))
  }
  for (const c of comments) {
    if (c.content)
      walk(
        c.content as JSONContent,
        (n) => n.type === 'mention' && n.attrs?.id && ids.add(n.attrs.id)
      )
  }
  if (ids.size === 0) return comments
  const { data } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', [...ids])
  const current = new Map(
    (data ?? []).map((p: { id: string; username: string }) => [p.id, p.username])
  )
  for (const c of comments) {
    if (!c.content) continue
    walk(c.content as JSONContent, (n) => {
      if (n.type === 'mention' && n.attrs?.id && current.has(n.attrs.id)) {
        n.attrs = { ...n.attrs, label: current.get(n.attrs.id) }
      }
    })
  }
  return comments
}
