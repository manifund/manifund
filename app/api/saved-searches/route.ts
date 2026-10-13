import { NextResponse } from 'next/server'
import { getSignedInProfile } from '@/lib/comments/auth'
import { deleteSearch, saveSearch, updateSearch } from '@/lib/follows'

export const runtime = 'nodejs'

type Body = { id?: string; query?: string; paused?: boolean }

// POST /api/saved-searches { query }: save the home page's current filters as a search (F5).
export async function POST(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const { query } = (await request.json().catch(() => ({}))) as Body
  if (typeof query !== 'string')
    return NextResponse.json({ error: 'query needed' }, { status: 400 })
  const result = await saveSearch(me.id, query)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ search: result.search }, { status: 201 })
}

// PATCH /api/saved-searches { id, paused }: pause or resume one of your searches.
export async function PATCH(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const { id, paused } = (await request.json().catch(() => ({}))) as Body
  if (!id || typeof paused !== 'boolean')
    return NextResponse.json({ error: 'id and paused needed' }, { status: 400 })
  const result = await updateSearch(me.id, id, { paused })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/saved-searches { id }: remove one of your searches.
export async function DELETE(request: Request) {
  const me = await getSignedInProfile()
  if (!me) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const { id } = (await request.json().catch(() => ({}))) as Body
  if (!id) return NextResponse.json({ error: 'id needed' }, { status: 400 })
  const result = await deleteSearch(me.id, id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
