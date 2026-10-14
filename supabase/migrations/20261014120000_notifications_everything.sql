-- Notifications: every event lands in the in-app list; essential kinds are always emailed right away, the optional
-- ones follow each person's one choice (immediately, daily or never).
-- Rules: docs/product/notifications/README.md. Additive only: wider checks, new nullable columns, a new table.

-- 1. More kinds of notifications (comments' eight, plus every event that only emailed before).
alter table public.notifications drop constraint if exists notifications_reason_check;
alter table public.notifications add constraint notifications_reason_check check (reason in (
  -- comments (lib/comments)
  'reply_to_you', 'mention', 'comment_on_your_project', 'comment_on_your_profile',
  'progress_update', 'final_report', 'followed_project_comment', 'moderated_your_comment',
  -- projects you follow (not comments)
  'followed_project_active', 'followed_project_closed',
  -- money to you
  'donation_to_your_project', 'donation_to_your_budget', 'tip_on_your_comment', 'new_offer',
  'grant_to_you', 'trade_accepted',
  -- money you gave
  'offered_project_active', 'offered_project_closed',
  -- your projects
  'project_verdict', 'project_active', 'project_not_funded', 'agreement_reminder', 'update_due',
  'project_flagged', 'auction_resolved',
  -- your account and money: records
  'deposit_receipt', 'payment_received', 'withdrawal_update', 'cash_to_charity', 'agreement_record',
  -- your account and money: reminders
  'unfinished_withdrawal', 'idle_balance'));

-- 2. 'digest': waiting for the daily summary email.
alter table public.notifications drop constraint if exists notifications_email_status_check;
alter table public.notifications add constraint notifications_email_status_check
  check (email_status in ('pending', 'sending', 'sent', 'skipped', 'failed', 'digest'));

-- 3. What a notification is about, one column per kind of source (comment_id already exists).
alter table public.notifications
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists bid_id uuid references public.bids(id) on delete set null,
  add column if not exists txn_id uuid references public.txns(id) on delete set null,
  add column if not exists withdrawal_request_id uuid references public.withdrawal_requests(id) on delete set null,
  add column if not exists amount numeric; -- the money involved, when there is one (shown in the list)

create index if not exists notifications_digest_idx
  on public.notifications (recipient_id, created_at) where email_status = 'digest';

-- 4. Each person's one email choice for optional notifications (N3), only when it isn't the default (daily, in code:
--    lib/notifications/kinds.ts): 'immediate' or 'never', or 'daily' again. Its own table rather than a profiles
--    column, because profiles are readable by everyone.
create table if not exists public.notification_email (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  choice text not null check (choice in ('immediate', 'daily', 'never')),
  updated_at timestamptz not null default now()
);
alter table public.notification_email enable row level security;
drop policy if exists "read own notification email" on public.notification_email;
create policy "read own notification email" on public.notification_email
  for select using (profile_id = auth.uid());
-- No insert/update/delete policies: only server code writes (lib/notifications/settings.ts).

-- 5. The backup sweep only ever sends comment emails; other kinds are sent inline (lib/notifications/notify.ts).
create or replace function public.claim_notification_emails(
  p_comment_id uuid default null, p_min_age interval default '0 seconds', p_limit int default 50
) returns setof public.notifications language sql as $$
  update public.notifications n
  set email_status = 'sending', email_claimed_at = now(), email_attempts = n.email_attempts + 1
  where n.id in (
    select id from public.notifications
    where (email_status = 'pending'
           or (email_status = 'sending' and email_claimed_at < now() - interval '10 minutes'))
      and comment_id is not null
      and (p_comment_id is null or comment_id = p_comment_id)
      and created_at <= now() - p_min_age
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning n.*;
$$;
