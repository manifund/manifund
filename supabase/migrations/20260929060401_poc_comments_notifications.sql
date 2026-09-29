-- POC comments, step 2 (design/comments-build.md, migration B). Additive only.
-- Notifications as data: one row per person per thing they should hear about. The same rows feed
-- the in-app list (read_at) and email (email_status). Written only by the server (lib/comments,
-- lib/notifications); people read their own.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'reply_to_you', 'mention', 'comment_on_your_project', 'comment_on_your_profile',
    'progress_update', 'final_report', 'followed_project_comment')),
  -- What it's about: one column per kind of source (later: bid_id, project_id, …).
  comment_id uuid references public.comments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  email_attempts int not null default 0,
  email_claimed_at timestamptz,
  emailed_at timestamptz,
  last_error text,
  unique (recipient_id, comment_id)
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unsent_idx
  on public.notifications (created_at) where email_status in ('pending', 'sending');

alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select using (recipient_id = auth.uid());

-- Claim rows to email, so two senders (the one right after a post, and the backup sweep) never
-- send the same row: pending rows, plus rows stuck in 'sending' for over 10 minutes (a sender that
-- died). Optionally only one comment's rows, or only rows older than some age.
create or replace function public.claim_notification_emails(
  p_comment_id uuid default null,
  p_min_age interval default interval '0 seconds',
  p_limit int default 50
) returns setof public.notifications
language sql as $$
  update public.notifications n
  set email_status = 'sending', email_claimed_at = now(), email_attempts = n.email_attempts + 1
  where n.id in (
    select id from public.notifications
    where (email_status = 'pending'
           or (email_status = 'sending' and email_claimed_at < now() - interval '10 minutes'))
      and (p_comment_id is null or comment_id = p_comment_id)
      and created_at <= now() - p_min_age
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning n.*;
$$;

revoke execute on function public.claim_notification_emails(uuid, interval, int)
  from public, anon, authenticated;
