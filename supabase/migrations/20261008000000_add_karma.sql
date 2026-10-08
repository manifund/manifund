-- Karma: a per-user and per-project reputation score. The formula lives in
-- utils/karma.ts; these columns only store its latest output, written by the
-- hourly recompute (app/api/karma/sync) through apply_karma below.
alter table public.profiles
  add column karma double precision not null default 0,
  add column karma_breakdown jsonb,
  add column karma_updated_at timestamptz;

alter table public.projects
  add column karma double precision not null default 0,
  add column karma_breakdown jsonb,
  add column karma_updated_at timestamptz;

create index projects_karma_idx on public.projects (karma desc);

-- Extend the existing guard (20260712000000_add_project_scores.sql) so project
-- creators can't edit their own project's karma through the row-update policy.
create or replace function public.protect_project_score_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.ai_fraction := old.ai_fraction;
    new.quality_score := old.quality_score;
    new.karma := old.karma;
    new.karma_breakdown := old.karma_breakdown;
    new.karma_updated_at := old.karma_updated_at;
  end if;
  return new;
end;
$$;

-- Users can update their own profile row, so guard profiles the same way.
create or replace function public.protect_profile_karma_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.karma := old.karma;
    new.karma_breakdown := old.karma_breakdown;
    new.karma_updated_at := old.karma_updated_at;
  end if;
  return new;
end;
$$;

create trigger protect_profile_karma_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_karma_columns();

-- Bulk writer for the recompute. Partial-row upserts through PostgREST would
-- trip NOT NULL constraints on the insert half, so update from a recordset.
create or replace function public.apply_karma(profile_rows jsonb, project_rows jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles p
     set karma = r.karma,
         karma_breakdown = r.breakdown,
         karma_updated_at = now()
    from jsonb_to_recordset(profile_rows) as r(id uuid, karma double precision, breakdown jsonb)
   where p.id = r.id;

  update public.projects j
     set karma = r.karma,
         karma_breakdown = r.breakdown,
         karma_updated_at = now()
    from jsonb_to_recordset(project_rows) as r(id uuid, karma double precision, breakdown jsonb)
   where j.id = r.id;
$$;

revoke execute on function public.apply_karma(jsonb, jsonb) from public, anon, authenticated;
