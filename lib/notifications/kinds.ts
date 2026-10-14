// Pure (no server-only imports), so unit tests and client components can import it.
// Every notification has a reason, and every reason shows in the in-app list. For email, a reason is either
// essential (always emailed right away, no setting) or optional (emailed per the person's one choice: immediately,
// daily or never). Rules N2-N4, docs/product/notifications/README.md.

export const NOTIFICATION_REASONS = [
  // comments (lib/comments)
  'reply_to_you',
  'mention',
  'comment_on_your_project',
  'comment_on_your_profile',
  'progress_update',
  'final_report',
  'followed_project_comment',
  'moderated_your_comment',
  // projects you follow (not comments)
  'followed_project_active',
  'followed_project_closed',
  // money to you
  'donation_to_your_project',
  'donation_to_your_budget',
  'tip_on_your_comment',
  'new_offer',
  'grant_to_you',
  'trade_accepted',
  // money you gave
  'offered_project_active',
  'offered_project_closed',
  // your projects
  'project_verdict',
  'project_active',
  'project_not_funded',
  'agreement_reminder',
  'update_due',
  'project_flagged',
  'auction_resolved',
  // your account and money: records
  'deposit_receipt',
  'payment_received',
  'withdrawal_update',
  'cash_to_charity',
  'agreement_record',
  // your account and money: reminders
  'unfinished_withdrawal',
  'idle_balance',
  // people and searches you follow (docs/product/follows)
  'followed_person_project',
  'followed_person_comment',
  'followed_person_donation',
  'saved_search_match',
] as const
export type NotificationReason = (typeof NOTIFICATION_REASONS)[number]

// Essential (N3): money that reaches you or that you gave, your projects' progress, records, and anything that
// needs you to act. Always emailed right away, with nothing about unsubscribing (N6).
export const ESSENTIAL_REASONS: readonly NotificationReason[] = [
  // money to you
  'donation_to_your_project',
  'donation_to_your_budget',
  'tip_on_your_comment',
  'new_offer',
  'grant_to_you',
  'trade_accepted',
  // money you gave: your offer became a donation, or came back
  'offered_project_active',
  'offered_project_closed',
  // your projects' timeline
  'project_verdict',
  'project_active',
  'project_not_funded',
  'agreement_reminder',
  'update_due',
  'project_flagged',
  'auction_resolved',
  // records
  'deposit_receipt',
  'payment_received',
  'withdrawal_update',
  'cash_to_charity',
  'agreement_record',
  // needs you
  'unfinished_withdrawal',
  'moderated_your_comment',
]

export function isEssential(reason: NotificationReason) {
  return ESSENTIAL_REASONS.includes(reason)
}

// The one choice for optional email (N4). Stored only when it isn't the default.
export const EMAIL_CHOICES = ['immediate', 'daily', 'never'] as const
export type EmailChoice = (typeof EMAIL_CHOICES)[number]
export const DEFAULT_EMAIL_CHOICE: EmailChoice = 'daily'

export function isEmailChoice(value: unknown): value is EmailChoice {
  return typeof value === 'string' && (EMAIL_CHOICES as readonly string[]).includes(value)
}

// A stored value, or the default when there is none (or it isn't a choice any longer).
export function emailChoice(stored?: string | null): EmailChoice {
  return isEmailChoice(stored) ? stored : DEFAULT_EMAIL_CHOICE
}

// How this reason is emailed to someone with this stored choice.
export function emailModeFor(reason: NotificationReason, stored?: string | null): EmailChoice {
  return isEssential(reason) ? 'immediate' : emailChoice(stored)
}

// What a notification row's email_status starts as: 'pending' is sent right away (comment emails by
// lib/notifications/send.ts, other kinds inline by notify.ts), 'digest' waits for the daily summary (N5).
export function initialEmailStatus(mode: EmailChoice): 'pending' | 'digest' | 'skipped' {
  return mode === 'never' ? 'skipped' : mode === 'daily' ? 'digest' : 'pending'
}

// What the optional emails are about, in the words the choice and the unsubscribe page use.
export const OPTIONAL_ABOUT =
  'replies, mentions, comments, updates on projects you follow, and the people and searches you follow'
