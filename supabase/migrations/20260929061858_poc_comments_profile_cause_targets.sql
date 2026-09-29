-- POC comments, steps 5-6 (design/comments-build.md, migrations E-F together). Additive, plus
-- `project` becomes nullable (a loosening: every existing row still has one).
-- A comment is about exactly one thing: a project, a person's profile, or a cause. One explicit
-- column per target (model B, decided 2026-09-28), so each row says plainly what it's about.

alter table public.comments
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists cause_slug text references public.causes(slug) on delete cascade
    on update cascade;
alter table public.comments alter column project drop not null;

alter table public.comments drop constraint if exists comments_one_target;
alter table public.comments add constraint comments_one_target
  check (num_nonnulls(project, profile_id, cause_slug) = 1) not valid;
alter table public.comments validate constraint comments_one_target;

create index if not exists comments_profile_created_idx
  on public.comments (profile_id, created_at desc) where profile_id is not null;
create index if not exists comments_cause_created_idx
  on public.comments (cause_slug, created_at desc) where cause_slug is not null;

-- The threading rule now compares every target column.
create or replace function public.comments_check_reply() returns trigger
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
