-- POC comments, step 3 (design/comments-build.md, migration C). Additive only.
-- Edits keep every past version; removals leave a placeholder ("deleted by the author" /
-- "removed by an admin: <reason>") and keep the text only in revisions, hidden from the public;
-- people can report a comment (optional note, spam toggle) to the admins.

alter table public.comments
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists removed_reason text;  -- null when the author deleted it

create table if not exists public.comment_revisions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  content jsonb,                     -- the version that was replaced
  written_at timestamptz not null,   -- when that version was written
  replaced_at timestamptz not null default now()
);
create index if not exists comment_revisions_comment_idx
  on public.comment_revisions (comment_id, written_at);

-- Every change to a comment's content keeps the old version, whoever writes (the app, an admin,
-- a script). An edit also stamps edited_at; a removal (content set to null) doesn't.
create or replace function public.comments_keep_revision() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content then
    insert into public.comment_revisions (comment_id, content, written_at)
    values (old.id, old.content, coalesce(old.edited_at, old.created_at));
    if new.deleted_at is null then
      new.edited_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists comments_keep_revision on public.comments;
create trigger comments_keep_revision
  before update of content on public.comments
  for each row execute function public.comments_keep_revision();

-- History is public for visible comments; a removed comment's history is for admins only
-- (service role).
alter table public.comment_revisions enable row level security;
drop policy if exists "history of visible comments" on public.comment_revisions;
create policy "history of visible comments" on public.comment_revisions for select using (
  exists (select 1 from public.comments c where c.id = comment_id and c.deleted_at is null));

create table if not exists public.comment_reports (
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
create index if not exists comment_reports_open_idx
  on public.comment_reports (created_at) where resolved_at is null;

alter table public.comment_reports enable row level security;
drop policy if exists "see own reports" on public.comment_reports;
create policy "see own reports" on public.comment_reports
  for select using (reporter_id = auth.uid());
