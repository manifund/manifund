-- AI moderation of comments and new accounts (docs/product/comments C38-C42, docs/product/people U2-U6).

-- 1. Held comments: flagged by the AI or the link check after posting. Everyone sees a collapsed
-- "hidden pending review: <category>" placeholder and can reveal it, except doxxing, whose words move to
-- held_comment_content (service role only) until an admin approves or removes the comment.
alter table public.comments
  add column held_at timestamptz,
  add column held_categories text[],  -- shown publicly on the placeholder; the reason is on the AI report
  add column moderated_at timestamptz; -- when the check finished (or was skipped); null = still to check

-- Everything already posted counts as checked. The notifications sweep re-runs the check for any comment left
-- unchecked (the after-response task died), so a comment can't silently lose its notifications.
update public.comments set moderated_at = created_at;
create index comments_unmoderated_idx on public.comments (created_at) where moderated_at is null;

create table public.held_comment_content (
  comment_id uuid primary key references public.comments(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.held_comment_content enable row level security; -- no policies: service role only

-- Moving words in or out of held_comment_content isn't an edit: no revision, no "edited" stamp.
create or replace function public.comments_keep_revision() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content and new.held_at is not distinct from old.held_at then
    insert into public.comment_revisions (comment_id, content, written_at, written_by, note)
    values (old.id, old.content, coalesce(old.edited_at, old.created_at),
            coalesce(old.edited_by, old.commenter), old.edit_note);
    if new.deleted_at is null then
      new.edited_at := now();
    end if;
  end if;
  return new;
end $$;

-- A comment held for doxxing keeps its history out of public view too.
drop policy "history of visible comments" on public.comment_revisions;
create policy "history of visible comments" on public.comment_revisions for select using (
  exists (select 1 from public.comments c where c.id = comment_id and c.deleted_at is null
          and not coalesce('doxxing' = any(c.held_categories), false)));

-- 2. Reports from the AI moderator: no reporter, source 'ai', with categories. Approving a held comment
-- closes its reports as 'approved'.
alter table public.comment_reports
  alter column reporter_id drop not null,
  add column source text not null default 'user' check (source in ('user', 'ai')),
  add column categories text[],
  drop constraint comment_reports_resolution_check,
  add constraint comment_reports_resolution_check check (resolution in ('dismissed', 'removed', 'approved'));

-- 3. Account holds: an account whose username or display name was flagged can't post projects or comments
-- until an admin clears it (or bans it). One row per checked account, also recording what was checked so a
-- rename is checked again.
create table public.account_holds (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  checked_username text not null,
  checked_full_name text,
  checked_at timestamptz not null default now(),
  held_at timestamptz,
  reason text,
  categories text[],
  model text,
  cleared_at timestamptz,
  cleared_by uuid references public.profiles(id) on delete set null
);
create index account_holds_open_idx on public.account_holds (held_at) where held_at is not null and cleared_at is null;

alter table public.account_holds enable row level security;
create policy "see own hold" on public.account_holds for select using (profile_id = auth.uid());

create or replace function public.is_held(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_holds h
                 where h.profile_id = uid and h.held_at is not null and h.cleared_at is null)
$$;

-- Projects are written from the browser under RLS, so the hold is enforced here: a held account can't
-- create a project or publish a draft. The server and admins are unaffected.
create or replace function public.refuse_held_projects() returns trigger
language plpgsql security invoker as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') and public.is_held(new.creator) then
    if tg_op = 'INSERT' or (old.stage = 'draft' and new.stage is distinct from 'draft') then
      raise exception 'account pending review' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger refuse_held_projects
  before insert or update of stage on public.projects
  for each row execute function public.refuse_held_projects();
