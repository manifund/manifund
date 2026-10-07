-- Org pages, second step: the columns the page shows that public.orgs didn't have, and reviews (comments on an
-- org). Plan: docs/plans/org-profiles-2026-10-06.md. Rules: docs/product/orgs/README.md.
--
-- Safe to apply before the code: everything is an added nullable column, or a rule loosened to allow the new
-- column. Code on main never sets comments.org_id, so its comments pass the new checks as they passed the old.

-- 1. More of what Manifund says about an org.
alter table public.orgs
  -- Shown as "Founded 2022". The year the work started, which can predate the legal entity.
  add column founded_year int check (founded_year between 1800 and 2100),
  -- Where the team is, as people say it: "Berkeley, CA". Separate from country/us_state, which say where the
  -- legal entity is registered.
  add column city text,
  -- Where the summary and about text came from: a list of URLs, shown under the about text.
  add column sources text[] not null default '{}';

-- 2. Reviews are comments on the org: a third target next to a project and a profile, one explicit column per
-- target (docs/product/comments/README.md). Star ratings aren't stored yet.
alter table public.comments
  add column org_id uuid references public.orgs (id) on delete cascade,
  drop constraint comments_one_target,
  add constraint comments_one_target check (num_nonnulls(project, profile_id, org_id) = 1);

create index comments_org_created_idx
  on public.comments (org_id, created_at desc) where org_id is not null;

-- One level of threads: as before, with the new target in the "same target as its parent" check.
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
     or parent.org_id is distinct from new.org_id then
    raise exception 'comments: a reply must be on the same target as its parent';
  end if;
  if new.special_type is not null then
    raise exception 'comments: replies are plain comments';
  end if;
  return new;
end $$;
