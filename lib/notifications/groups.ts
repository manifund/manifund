// Pure (no server-only imports), so unit tests and client components can import it.
// Every notification has a reason; every reason belongs to one settings group; a person chooses
// email per group (rules N2-N5, docs/product/notifications/README.md). In-app is always on.

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

// A person's email choice for a group (N3): right away, or in the weekly summary (N6). 'off' is what an email's
// unsubscribe button sets (N7); the settings page offers only the two choices.
export const EMAIL_CHOICES = ['instant', 'weekly'] as const
export type EmailChoice = (typeof EMAIL_CHOICES)[number]
export type EmailMode = EmailChoice | 'off'
const EMAIL_MODES: readonly string[] = [...EMAIL_CHOICES, 'off']

export const GROUP_KEYS = [
  'direct_activity',
  'followed_activity',
  'moderation',
  'money_to_you',
  'money_you_gave',
  'your_projects',
  'records',
  'balance_reminders',
  'following',
  'saved_searches',
] as const
export type GroupKey = (typeof GROUP_KEYS)[number]

export type NotificationGroup = {
  key: GroupKey
  section: string
  label: string
  default: EmailChoice
  // Always emailed right away (N4): no settings row, no unsubscribe; the settings page names it in its
  // "Manifund always sends emails for ..." line.
  always?: { about: string }
  reasons: readonly NotificationReason[]
}

export const GROUPS: readonly NotificationGroup[] = [
  {
    key: 'direct_activity',
    section: 'Activity',
    label: 'Replies, mentions, and comments on your projects and profile',
    default: 'weekly', // Vals 2026-10-09: the follow and activity emails default to weekly
    reasons: ['reply_to_you', 'mention', 'comment_on_your_project', 'comment_on_your_profile'],
  },
  {
    key: 'followed_activity',
    section: 'Activity',
    label: 'Updates, final reports and comments on projects you follow',
    default: 'weekly', // Vals 2026-10-09: the follow and activity emails default to weekly
    reasons: [
      'progress_update',
      'final_report',
      'followed_project_comment',
      'followed_project_active',
      'followed_project_closed',
    ],
  },
  {
    key: 'moderation',
    section: 'Activity',
    label: 'A moderator edited or removed your comment',
    default: 'instant',
    always: { about: 'a moderator editing or removing your comment' },
    reasons: ['moderated_your_comment'],
  },
  {
    key: 'money_to_you',
    section: 'Money',
    label: 'Money to you: donations, offers, regranting budget, tips, grants',
    default: 'instant',
    reasons: [
      'donation_to_your_project',
      'donation_to_your_budget',
      'tip_on_your_comment',
      'new_offer',
      'grant_to_you',
      'trade_accepted',
    ],
  },
  {
    key: 'money_you_gave',
    section: 'Money',
    label: 'Projects you offered on became active or closed',
    default: 'instant',
    reasons: ['offered_project_active', 'offered_project_closed'],
  },
  {
    key: 'your_projects',
    section: 'Your projects',
    label: 'Approval, activation, not funded, reminders (agreement to sign, update due)',
    default: 'instant',
    reasons: [
      'project_verdict',
      'project_active',
      'project_not_funded',
      'agreement_reminder',
      'update_due',
      'project_flagged',
      'auction_resolved',
    ],
  },
  {
    key: 'records',
    section: 'Your account',
    label:
      'Receipts and records: deposits, payments, withdrawals, cash moved to charity, grant agreements',
    default: 'instant',
    always: {
      about:
        'receipts and records (deposits, payments, withdrawals, cash moved to charity, grant agreements)',
    },
    reasons: [
      'deposit_receipt',
      'payment_received',
      'withdrawal_update',
      'cash_to_charity',
      'agreement_record',
    ],
  },
  {
    key: 'balance_reminders',
    section: 'Your account',
    label: 'Balance reminders: an unfinished withdrawal, money sitting idle',
    default: 'instant',
    reasons: ['unfinished_withdrawal', 'idle_balance'],
  },
  {
    key: 'following',
    section: 'People and searches you follow',
    label: 'People you follow: their new projects, comments and donations',
    default: 'weekly', // Vals 2026-10-09: "I'd have all emails default to weekly"
    reasons: ['followed_person_project', 'followed_person_comment', 'followed_person_donation'],
  },
  {
    key: 'saved_searches',
    section: 'People and searches you follow',
    label: 'New projects matching your saved searches',
    default: 'weekly', // Vals 2026-10-05: matches weekly by default, "or daily or instant"
    reasons: ['saved_search_match'],
  },
]

export function groupOf(reason: NotificationReason): NotificationGroup {
  const group = GROUPS.find((g) => g.reasons.includes(reason))
  if (!group) throw new Error(`notifications: reason ${reason} has no group`)
  return group
}

export function groupByKey(key: string): NotificationGroup | undefined {
  return GROUPS.find((g) => g.key === key)
}

// The email mode that applies: an "always" group ignores settings; otherwise the person's stored mode, or the
// group's default when there is none or it isn't a mode (any longer).
export function emailModeFor(
  reason: NotificationReason,
  overrides: Partial<Record<string, string>>
): EmailMode {
  const group = groupOf(reason)
  return effectiveMode(group, overrides[group.key])
}

export function effectiveMode(group: NotificationGroup, stored?: string): EmailMode {
  if (group.always) return 'instant'
  return stored && EMAIL_MODES.includes(stored) ? (stored as EmailMode) : group.default
}

// What a notification row's email_status starts as, for a mode: 'pending' is sent right away (comment emails
// by lib/notifications/send.ts, other kinds inline by notify.ts), 'digest' waits for the weekly summary (N6).
export function initialEmailStatus(mode: EmailMode): 'pending' | 'digest' | 'skipped' {
  return mode === 'off' ? 'skipped' : mode === 'weekly' ? 'digest' : 'pending'
}
