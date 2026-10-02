import { describe, expect, test } from 'bun:test'
import { withCurrentMentionLabels } from '@/lib/comments/mentions'
import { docWithMention } from '../helpers/content'

// A stand-in for the Supabase client: answers the one profiles query the helper makes.
const fakeSupabase = (profiles: { id: string; username: string }[]) => {
  const calls: string[][] = []
  const client = {
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          calls.push(ids)
          return Promise.resolve({ data: profiles.filter((p) => ids.includes(p.id)) })
        },
      }),
    }),
  }
  return { client: client as any, calls }
}

describe('C32 mentions show the current username', () => {
  test('an old username in a mention is replaced by the current one', async () => {
    const { client } = fakeSupabase([{ id: 'u1', username: 'apolloresearch' }])
    const [c] = await withCurrentMentionLabels(client, [{ content: docWithMention('u1', 'apollo', 'thanks') }])
    expect(JSON.stringify(c.content)).toContain('"label":"apolloresearch"')
  })
  test('one lookup for a whole page of comments; none when nobody is mentioned', async () => {
    const { client, calls } = fakeSupabase([])
    await withCurrentMentionLabels(client, [
      { content: docWithMention('u1', 'a', 'x') },
      { content: docWithMention('u2', 'b', 'y') },
      { content: null },
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0].sort()).toEqual(['u1', 'u2'])
    const none = fakeSupabase([])
    await withCurrentMentionLabels(none.client, [{ content: { type: 'doc', content: [] } }])
    expect(none.calls).toHaveLength(0)
  })
})
