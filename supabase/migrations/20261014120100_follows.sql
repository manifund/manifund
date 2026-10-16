-- Following people and saving searches: notifications when someone you follow posts a project, comments or
-- donates, and when a new project matches a saved search. Rules: docs/product/follows/README.md.
-- Additive only and idempotent: new tables, a new nullable column, a wider check.

-- Row-level security as for project_follows: anyone reads (follows and saved searches are public, F2), people
-- insert and delete only their own rows; no updates.

-- 1. Following a person: everything they do.
create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint profile_follows_not_self check (follower_id <> followed_id)
);
create index if not exists profile_follows_followed_idx on public.profile_follows (followed_id);
alter table public.profile_follows enable row level security;
drop policy if exists "read own follows" on public.profile_follows;
drop policy if exists "Enable read access for all users" on public.profile_follows;
create policy "Enable read access for all users" on public.profile_follows for select using (true);
drop policy if exists "Insert own follows" on public.profile_follows;
create policy "Insert own follows" on public.profile_follows for insert to authenticated
  with check (follower_id = auth.uid());
drop policy if exists "Delete own follows" on public.profile_follows;
create policy "Delete own follows" on public.profile_follows for delete to authenticated
  using (follower_id = auth.uid());

-- 2. Saved searches: home's search text and categories as a query string, matched against new projects. A search
-- exists or is removed: no pausing, no per-search frequency (the one email choice applies, N4).
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  query text not null,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_owner_idx on public.saved_searches (owner_id);
alter table public.saved_searches enable row level security;
drop policy if exists "read own saved searches" on public.saved_searches;
drop policy if exists "Enable read access for all users" on public.saved_searches;
create policy "Enable read access for all users" on public.saved_searches for select using (true);
drop policy if exists "Insert own saved searches" on public.saved_searches;
create policy "Insert own saved searches" on public.saved_searches for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "Delete own saved searches" on public.saved_searches;
create policy "Delete own saved searches" on public.saved_searches for delete to authenticated
  using (owner_id = auth.uid());

-- 3. Notifications about them.
alter table public.notifications
  add column if not exists saved_search_id uuid references public.saved_searches(id) on delete cascade;
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
  'unfinished_withdrawal', 'idle_balance',
  -- people and searches you follow
  'followed_person_project', 'followed_person_comment', 'followed_person_donation', 'saved_search_match'));
-- (No unique index on saved searches' notifications: F7, one per person per project, is checked in
-- lib/follows, and an index couldn't stop a duplicate email anyway: notify() sends even when recording fails.)
