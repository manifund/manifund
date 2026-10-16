-- Only the server decides whether a project is approved, has a signed agreement, what type it is,
-- and who created it. Creators keep editing their project's other fields from the site as before.
-- For anyone but the server: on insert, approval and agreement start unset; on update, these
-- columns keep their current values whatever the update carries. Same pattern as the karma guards.
-- The app writes these columns only with the service role (verdicts, agreement signing, project
-- transfers) or through security definer functions (give_grant_v2, create_transfer_grant_v2),
-- which run as their owner, so they're unaffected.

create or replace function public.protect_project_approval_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.approved := null;
      new.signed_agreement := false;
    else
      new.approved := old.approved;
      new.signed_agreement := old.signed_agreement;
      new.type := old.type;
      new.creator := old.creator;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_project_approval_columns on public.projects;
create trigger protect_project_approval_columns
  before insert or update on public.projects
  for each row
  execute function public.protect_project_approval_columns();
