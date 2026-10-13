// Pure: turns a notification row (with its joined sources) into one line for the inbox and the
// weekly summary email (N5, N6). No server-only imports.
import { formatMoney } from '@/utils/formatting'

export type NotificationRow = {
  id: string
  reason: string
  created_at: string
  read_at: string | null
  amount: number | null
  actor: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  } | null
  project: { title: string; slug: string; approved: boolean | null } | null
  withdrawal: { status: string } | null
  commentHref?: string // for comment reasons
  commentTitle?: string
  excerpt?: string
}

export type Described = {
  who?: string // shown bold, before the text (the actor)
  text: string
  subject?: string // shown bold, after the text (a project title)
  detail?: string // the second line
  href: string
  icon: 'avatar' | 'money-in' | 'money-out' | 'check' | 'alert' | 'clock' | 'doc'
}

const COMMENT_WHAT: Record<string, string> = {
  reply_to_you: 'replied to you on',
  mention: 'mentioned you on',
  comment_on_your_project: 'commented on your project',
  comment_on_your_profile: 'commented on your profile',
  progress_update: 'posted a progress update on',
  final_report: 'posted a final report on',
  followed_project_comment: 'commented on',
  moderated_your_comment: 'moderated your comment on',
}

export function describe(n: NotificationRow, me: { username: string }): Described {
  const who = n.actor ? n.actor.full_name || n.actor.username : undefined
  const money = n.amount != null ? formatMoney(Number(n.amount)) : ''
  const p = n.project
  const projectHref = p ? `/projects/${p.slug}` : '/'
  const subject = p?.title
  const mine = `/${me.username}`
  if (n.reason in COMMENT_WHAT) {
    return {
      who,
      text: COMMENT_WHAT[n.reason],
      subject: n.reason === 'comment_on_your_profile' ? undefined : n.commentTitle,
      detail: n.excerpt,
      href: n.commentHref ?? '#',
      icon: 'avatar',
    }
  }
  switch (n.reason) {
    case 'donation_to_your_project':
      return { who, text: `donated ${money} to`, subject, href: projectHref, icon: 'money-in' }
    case 'donation_to_your_budget':
      return { who, text: `gave ${money} to your regranting budget`, href: mine, icon: 'money-in' }
    case 'tip_on_your_comment':
      return { who, text: `tipped you ${money} for a comment`, href: mine, icon: 'money-in' }
    case 'new_offer':
      return {
        who,
        text: `offered ${money} on`,
        subject,
        detail: 'An offer turns into a donation once the project reaches its minimum',
        href: projectHref,
        icon: 'money-in',
      }
    case 'grant_to_you':
      return {
        who,
        text: `gave you a ${money} grant:`,
        subject,
        href: projectHref,
        icon: 'money-in',
      }
    case 'trade_accepted':
      return {
        who,
        text: 'traded with your offer on',
        subject,
        href: projectHref,
        icon: 'money-in',
      }
    case 'offered_project_active':
      return {
        text: 'is active: your offer became a donation',
        who: subject,
        href: projectHref,
        icon: 'check',
      }
    case 'offered_project_closed':
      return {
        text: 'closed: your offer was resolved',
        who: subject,
        href: projectHref,
        icon: 'clock',
      }
    case 'followed_project_active':
      return { text: 'is active', who: subject, href: projectHref, icon: 'check' }
    case 'followed_project_closed':
      return { text: "wasn't funded", who: subject, href: projectHref, icon: 'clock' }
    case 'project_verdict':
      return {
        text: p?.approved === false ? 'Manifund declined' : 'Manifund approved',
        subject,
        href: projectHref,
        icon: p?.approved === false ? 'alert' : 'check',
      }
    case 'project_active':
      return {
        who: subject,
        text: 'is active: offers became donations',
        detail: 'You can withdraw the funds',
        href: '/withdraw',
        icon: 'check',
      }
    case 'project_not_funded':
      return {
        who: subject,
        text: "wasn't funded",
        detail: money ? `It raised ${money}, below its minimum` : undefined,
        href: projectHref,
        icon: 'clock',
      }
    case 'agreement_reminder':
      return {
        text: 'Sign the grant agreement for',
        subject,
        href: p ? `/projects/${p.slug}/agreement` : '/',
        icon: 'doc',
      }
    case 'update_due':
      return {
        who: subject,
        text: 'is due for a progress update',
        href: projectHref,
        icon: 'clock',
      }
    case 'project_flagged':
      return {
        who: subject,
        text: 'was flagged by the spam filter',
        href: projectHref,
        icon: 'alert',
      }
    case 'auction_resolved':
      return { text: 'The auction is resolved for', subject, href: projectHref, icon: 'check' }
    case 'deposit_receipt':
      return {
        text: `Deposit received: ${money} added to your charity balance`,
        detail: 'Receipt for your records',
        href: mine,
        icon: 'money-in',
      }
    case 'payment_received':
      return {
        text: `Payment received: ${money}`,
        detail: 'Receipt for your records',
        href: mine,
        icon: 'money-in',
      }
    case 'withdrawal_update': {
      const status = n.withdrawal?.status
      const what =
        status === 'sent' || status === 'completed'
          ? 'sent'
          : status === 'failed' || status === 'cancelled' || status === 'canceled'
            ? "didn't go through"
            : 'queued'
      return {
        text: `Withdrawal of ${money} ${what}`,
        href: '/withdraw/request',
        icon: 'money-out',
      }
    }
    case 'cash_to_charity':
      return {
        text: `${money} moved from cash to your charity balance`,
        href: mine,
        icon: 'money-out',
      }
    case 'agreement_record':
      return {
        text: 'Grant agreement signed for',
        subject,
        detail: 'A copy was emailed to you',
        href: projectHref,
        icon: 'doc',
      }
    case 'unfinished_withdrawal':
      return {
        text: `Finish your withdrawal of ${money}`,
        href: '/withdraw/request',
        icon: 'alert',
      }
    case 'idle_balance':
      return {
        text: `${money} has been in your balance for over a year`,
        href: mine,
        icon: 'clock',
      }
    default:
      return { text: 'Notification', href: '/notifications', icon: 'alert' }
  }
}

// One plain line, for the weekly summary email.
export function plainLine(d: Described) {
  return [d.who, d.text, d.subject].filter(Boolean).join(' ')
}
