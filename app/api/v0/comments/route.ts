import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/db/supabase-server'
import { toMarkdown } from '@/utils/tiptap-parsing'

async function listCommentsPaginated(supabase: SupabaseClient, before?: string | null) {
  let query = supabase
    .from('comments')
    .select(
      `
      id,
      created_at,
      content,
      commenter,
      project,
      profiles!comments_commenter_fkey(username, full_name),
      projects(title, slug),
      replying_to,
      special_type,
      edited_at,
      deleted_at,
      removed_reason
    `
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (before) {
    const timestamp = new Date(before).toISOString()
    query = query.filter('created_at', 'lt', timestamp)
  }

  const { data } = await query.throwOnError()
  return data
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')

  const supabase = await createServerSupabaseClient()
  const comments = await listCommentsPaginated(supabase, before)

  comments?.map((comment) => {
    // Convert Tiptap content to markdown
    comment.content = comment.content ? toMarkdown(comment.content) : null
    // Convert created_at to ISO string
    comment.created_at = new Date(comment.created_at).toISOString()
  })

  return NextResponse.json(comments)
}
