-- Incremental karma nudge applied when a vote changes, so the number moves right
-- away instead of waiting for the hourly recompute (which rewrites every row and
-- corrects any drift). Service role only.
create or replace function public.adjust_karma(
  project_id uuid,
  project_delta double precision,
  profile_id uuid,
  profile_delta double precision
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.projects set karma = karma + project_delta where id = project_id;
  update public.profiles set karma = karma + profile_delta where id = profile_id;
$$;

revoke execute on function public.adjust_karma(uuid, double precision, uuid, double precision)
  from public, anon, authenticated;
