import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_EMAIL_CHOICE,
  EMAIL_CHOICES,
  ESSENTIAL_REASONS,
  NOTIFICATION_REASONS,
  emailChoice,
  emailModeFor,
  initialEmailStatus,
  isEssential,
} from '@/lib/notifications/kinds'

describe('N3 essential notifications are always emailed right away', () => {
  test('money, your projects, records and what needs you, whatever the choice', () => {
    for (const r of [
      'donation_to_your_project',
      'grant_to_you',
      'offered_project_active',
      'project_verdict',
      'agreement_reminder',
      'withdrawal_update',
      'unfinished_withdrawal',
      'idle_balance',
      'moderated_your_comment',
    ] as const) {
      expect(isEssential(r)).toBe(true)
      for (const c of EMAIL_CHOICES) expect(emailModeFor(r, c)).toBe('immediate')
    }
  })
  test('every essential reason is a known reason', () => {
    for (const r of ESSENTIAL_REASONS) expect(NOTIFICATION_REASONS).toContain(r)
  })
})

describe('N4 everything else follows the one choice: immediately, daily (the default) or never', () => {
  const optional = NOTIFICATION_REASONS.filter((r) => !isEssential(r))
  test('comments, replies, follows, saved searches and tips are optional', () => {
    for (const r of [
      'reply_to_you',
      'mention',
      'comment_on_your_project',
      'progress_update',
      'followed_person_project',
      'saved_search_match',
      'tip_on_your_comment',
    ] as const)
      expect(optional).toContain(r)
  })
  test('the stored choice applies; none, or an unknown one, means daily', () => {
    expect(DEFAULT_EMAIL_CHOICE).toBe('daily')
    for (const r of optional) {
      expect(emailModeFor(r, null)).toBe('daily')
      expect(emailModeFor(r, 'weekly')).toBe('daily')
      expect(emailModeFor(r, 'immediate')).toBe('immediate')
      expect(emailModeFor(r, 'never')).toBe('never')
    }
    expect(emailChoice('instant')).toBe('daily')
  })
  test('a new row waits for the summary, goes out now, or is skipped', () => {
    expect(initialEmailStatus('immediate')).toBe('pending')
    expect(initialEmailStatus('daily')).toBe('digest')
    expect(initialEmailStatus('never')).toBe('skipped')
  })
})
