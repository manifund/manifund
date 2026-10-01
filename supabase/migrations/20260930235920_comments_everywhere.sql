-- Comments everywhere: comments on projects, profiles and programs; edit history; moderation; reports;
-- notifications. Rules: docs/product/comments/README.md.
--
-- BEFORE DEPLOY. Every change here is additive or a loosening, so the code on main keeps working once it's
-- applied (main never writes the new columns; `project` becomes nullable but main only ever sets it). Apply it in
-- one transaction (e.g. `psql --single-transaction -f`), then deploy the code, then run
-- supabase/prod-only/comments-rework.sql (after deploy: drops the paths the new code no longer uses).
-- One side effect before deploy: a reply to a reply from main's UI is now refused (main can post those; the
-- new code moves them under the top-level comment).
-- Tested on a fresh copy of production's schema (2026-09-30): see supabase/prod-only/README.md.

-- Comment types posted by server flows (a grant's rationale, an admin's verdict note).
alter type public.comment_type add value 'grant rationale';
alter type public.comment_type add value 'admin note';

-- 1. What a comment is about: exactly one of a project, a profile, or a program (a cause). One explicit column
-- per target, so each row says plainly what it's about.
alter table public.comments
  add column profile_id uuid references public.profiles(id) on delete cascade,
  add column cause_slug text references public.causes(slug) on delete cascade on update cascade,
  alter column project drop not null,
  add constraint comments_one_target check (num_nonnulls(project, profile_id, cause_slug) = 1);

create index comments_project_created_idx on public.comments (project, created_at desc);
create index comments_profile_created_idx
  on public.comments (profile_id, created_at desc) where profile_id is not null;
create index comments_cause_created_idx
  on public.comments (cause_slug, created_at desc) where cause_slug is not null;
create index comments_replying_to_idx on public.comments (replying_to);

-- 2. One level of threads, whoever writes: a reply answers a top-level comment on the same target, and is a
-- plain comment.
create function public.comments_check_reply() returns trigger
language plpgsql as $$
declare
  parent public.comments;
begin
  if new.replying_to is null then
    return new;
  end if;
  select * into parent from public.comments where id = new.replying_to;
  if not found then
    raise exception 'comments: reply to a missing comment';
  end if;
  if parent.replying_to is not null then
    raise exception 'comments: replies must answer a top-level comment';
  end if;
  if parent.project is distinct from new.project
     or parent.profile_id is distinct from new.profile_id
     or parent.cause_slug is distinct from new.cause_slug then
    raise exception 'comments: a reply must be on the same target as its parent';
  end if;
  if new.special_type is not null then
    raise exception 'comments: replies are plain comments';
  end if;
  return new;
end $$;

create trigger comments_check_reply
  before insert or update of replying_to on public.comments
  for each row execute function public.comments_check_reply();

-- 3. Edits and moderation. Authors edit (no deleting); moderators edit with a public note, or remove with a
-- public reason (content becomes null; the text stays in the revisions, for admins only).
alter table public.comments
  add column edited_at timestamptz,
  add column edited_by uuid references public.profiles(id) on delete set null,
  add column edit_note text,                -- a moderator's note on the current version
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null,
  add column removed_reason text;

create table public.comment_revisions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  content jsonb,                     -- the version that was replaced
  written_at timestamptz not null,   -- when that version was written
  written_by uuid references public.profiles(id) on delete set null,
  note text,                         -- the moderator's note that came with that version
  replaced_at timestamptz not null default now()
);
create index comment_revisions_comment_idx on public.comment_revisions (comment_id, written_at);

-- Every change to a comment's words keeps the previous version and who wrote it, whoever writes (the app, an
-- admin, a script). An edit stamps edited_at; a removal doesn't.
create function public.comments_keep_revision() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content then
    insert into public.comment_revisions (comment_id, content, written_at, written_by, note)
    values (old.id, old.content, coalesce(old.edited_at, old.created_at),
            coalesce(old.edited_by, old.commenter), old.edit_note);
    if new.deleted_at is null then
      new.edited_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger comments_keep_revision
  before update of content on public.comments
  for each row execute function public.comments_keep_revision();

-- History is public for visible comments; a removed comment's history is for admins (service role) only.
alter table public.comment_revisions enable row level security;
create policy "history of visible comments" on public.comment_revisions for select using (
  exists (select 1 from public.comments c where c.id = comment_id and c.deleted_at is null));

-- 4. Reports: anyone signed in reports someone else's comment once, with an optional note and a spam flag.
create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  is_spam boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution text check (resolution in ('dismissed', 'removed')),
  unique (comment_id, reporter_id)
);
create index comment_reports_open_idx on public.comment_reports (created_at) where resolved_at is null;

alter table public.comment_reports enable row level security;
create policy "see own reports" on public.comment_reports for select using (reporter_id = auth.uid());

-- 5. Notifications: one row per person per thing they should hear about, feeding both the in-app list
-- (read_at) and email (email_status). Written only by the server; people read their own.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null constraint notifications_reason_check check (reason in (
    'reply_to_you', 'mention', 'comment_on_your_project', 'comment_on_your_profile',
    'progress_update', 'final_report', 'followed_project_comment', 'moderated_your_comment')),
  -- What it's about: one column per kind of source (later: bid_id, project_id, ...).
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
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unsent_idx
  on public.notifications (created_at) where email_status in ('pending', 'sending');

alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select using (recipient_id = auth.uid());

-- Claim rows to email, so two senders (the one right after a post, and the backup sweep) never send the same
-- row: pending rows, plus rows stuck in 'sending' for over 10 minutes (a sender that died). Optionally only one
-- comment's rows, or only rows older than some age. Service role only.
create function public.claim_notification_emails(
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

-- 6. Grant functions without comment inserts: the grant's money and project stay in one transaction; the
-- rationale and the admin's note are posted by lib/comments afterwards (types 'grant rationale' / 'admin
-- note'), so every comment has one writer and one notification path. The old versions are dropped after
-- deploy (prod-only).
create function public.give_grant_v2(project public.project_row, donation public.bid_row)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or donation.bidder is distinct from auth.uid()
     or donation.amount is null
     or donation.amount < 0 then
    raise exception 'give_grant_v2: caller mismatch or invalid amount';
  end if;

  insert into projects (id, creator, title, blurb, description, min_funding, funding_goal, founder_shares, type, stage, round, slug, approved, signed_agreement, location_description, lobbying)
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, project.type, project.stage, project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into bids (project, amount, bidder, type, valuation)
  values (donation.project, donation.amount, donation.bidder, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, donation.bidder)
  on conflict do nothing;
end $$;

create function public.create_transfer_grant_v2(
  project public.project_row, project_transfer public.transfer_row, grant_amount numeric)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or project.creator is distinct from auth.uid()
     or grant_amount is null
     or grant_amount < 0 then
    raise exception 'create_transfer_grant_v2: caller mismatch or invalid amount';
  end if;

  insert into projects (id, creator, title, blurb, description, min_funding, funding_goal, founder_shares, type, stage, round, slug, approved, signed_agreement, location_description, lobbying)
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, project.type, project.stage, project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into project_transfers (recipient_email, recipient_name, project_id)
  values (project_transfer.recipient_email, project_transfer.recipient_name, project_transfer.project_id);

  insert into bids (project, amount, bidder, type, valuation)
  values (project.id, grant_amount, project.creator, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, project.creator)
  on conflict do nothing;
end $$;

-- Called with the service role from the admin route.
create function public.execute_grant_verdict_v2(
  approved boolean, project_id uuid, admin_id uuid, public_benefit text default null)
returns void
language plpgsql
as $$
#variable_conflict use_variable
begin
  update projects
  set approved = approved, public_benefit = public_benefit
  where id = project_id;

  if not approved then
    perform reject_proposal(project_id);
  else
    update grant_agreements
    set approved_at = now(), approved_by = admin_id
    where grant_agreements.project_id = execute_grant_verdict_v2.project_id;
  end if;
end $$;
revoke execute on function public.execute_grant_verdict_v2(boolean, uuid, uuid, text)
  from public, anon, authenticated;
