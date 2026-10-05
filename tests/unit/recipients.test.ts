import { describe, expect, test } from 'bun:test'
import { pickRecipients } from '@/lib/notifications/pick'
import type { Recipient } from '@/lib/comments/types'

describe('C21 one notification per person, for the strongest reason', () => {
  test('the strongest reason wins', () => {
    const picked = pickRecipients(
      [
        { id: 'creator', reason: 'comment_on_your_project' },
        { id: 'creator', reason: 'mention' },
        { id: 'follower', reason: 'followed_project_comment' },
        { id: 'follower', reason: 'reply_to_you' },
      ],
      'author'
    )
    const byId = Object.fromEntries(picked.map((r) => [r.id, r.reason]))
    expect(byId).toEqual({ creator: 'mention', follower: 'reply_to_you' })
  })
  test('the author is never notified of their own comment', () => {
    expect(pickRecipients([{ id: 'author', reason: 'mention' }], 'author')).toEqual([])
  })
  test('an email covered by another email stays covered whichever reason wins (C23)', () => {
    const recipients: Recipient[] = [
      { id: 'creator', reason: 'comment_on_your_project', email: false },
      { id: 'creator', reason: 'mention' },
    ]
    const [r] = pickRecipients(recipients, 'regrantor')
    expect(r.reason).toBe('mention')
    expect(r.email).toBe(false)
    const reversed = pickRecipients([...recipients].reverse(), 'regrantor')
    expect(reversed[0].email).toBe(false)
  })
})
