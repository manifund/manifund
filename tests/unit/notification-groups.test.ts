import {
  EMAIL_CHOICES,
  GROUPS,
  NOTIFICATION_REASONS,
  emailModeFor,
  groupByKey,
  groupOf,
  initialEmailStatus,
} from '@/lib/notifications/groups'
import { REASONS } from '@/lib/comments/types'

describe('N2 every reason belongs to exactly one settings group', () => {
  test('each reason, including every comment reason, has one group', () => {
    for (const reason of [...NOTIFICATION_REASONS, ...REASONS]) {
      expect(GROUPS.filter((g) => g.reasons.includes(reason))).toHaveLength(1)
    }
  })
  test('the groups Vals named', () => {
    expect(groupOf('reply_to_you').key).toBe('direct_activity')
    expect(groupOf('comment_on_your_profile').key).toBe('direct_activity')
    expect(groupOf('progress_update').key).toBe('followed_activity')
    expect(groupOf('followed_project_comment').key).toBe('followed_activity')
    for (const r of [
      'donation_to_your_project',
      'new_offer',
      'tip_on_your_comment',
      'grant_to_you',
    ] as const) {
      expect(groupOf(r).key).toBe('money_to_you')
    }
  })
})

describe('N3 defaults: activity and follows weekly, the rest right away; a choice changes its own group', () => {
  test('without settings, activity and follows emails wait for the weekly summary; the rest go out right away', () => {
    // Vals, 2026-10-05 and 2026-10-09
    const weekly = new Set<string>(
      ['direct_activity', 'followed_activity'].flatMap((k) => groupByKey(k)!.reasons)
    )
    for (const reason of NOTIFICATION_REASONS)
      expect(emailModeFor(reason, {})).toBe(weekly.has(reason) ? 'weekly' : 'instant')
  })
  test('an override changes its group only', () => {
    const o = { direct_activity: 'instant' }
    expect(emailModeFor('mention', o)).toBe('instant')
    expect(emailModeFor('progress_update', o)).toBe('weekly') // followed activity, weekly by default (N3)
  })
  test('a stored value that is not a mode (e.g. the removed daily summary) counts as the default', () => {
    expect(emailModeFor('new_offer', { money_to_you: 'daily' })).toBe('instant')
    expect(emailModeFor('mention', { direct_activity: 'daily' })).toBe('weekly')
  })
  test('statuses: right away waits to be sent, weekly waits for the summary, unsubscribed is skipped', () => {
    expect(initialEmailStatus('instant')).toBe('pending')
    expect(initialEmailStatus('weekly')).toBe('digest')
    expect(initialEmailStatus('off')).toBe('skipped')
  })
})

describe('N4 always-emailed groups ignore settings', () => {
  test('moderation of your comment (Vals, 2026-10-07)', () => {
    expect(emailModeFor('moderated_your_comment', { moderation: 'off' })).toBe('instant')
  })
  test('receipts and records (assumption)', () => {
    for (const r of [
      'deposit_receipt',
      'withdrawal_update',
      'cash_to_charity',
      'agreement_record',
    ] as const) {
      expect(emailModeFor(r, { records: 'off' })).toBe('instant')
    }
  })
})

describe('N6 every optional group offers the same two choices: right away or weekly', () => {
  test('the choices', () => {
    expect([...EMAIL_CHOICES]).toEqual(['instant', 'weekly'])
  })
  test('every group is either always emailed or optional with a default among the choices', () => {
    for (const g of GROUPS) {
      if (g.always) expect(g.default).toBe('instant')
      else expect(EMAIL_CHOICES).toContain(g.default)
    }
  })
})

describe('N7 an unsubscribed group sends nothing', () => {
  test('off applies to optional groups, never to always-emailed ones', () => {
    expect(emailModeFor('new_offer', { money_to_you: 'off' })).toBe('off')
    expect(emailModeFor('deposit_receipt', { records: 'off' })).toBe('instant')
  })
})
