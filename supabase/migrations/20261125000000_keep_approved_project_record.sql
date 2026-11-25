-- Keep a public record of approved projects.
--
-- 1. People can no longer hide a project once Manifund has approved it (P7). They still hide unapproved ones, and
--    the server (admins, the spam flow) can still hide any project. Otherwise unchanged from
--    20261016120000_project_stage_server_only.sql.
-- 2. Deleting an admin's profile no longer deletes the grant agreements they countersigned: the agreement stays,
--    with no approver recorded.

create or replace function public.protect_project_stage()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.stage not in ('draft', 'proposal') then
        new.stage := 'proposal';
      end if;
    elsif new.stage is distinct from old.stage
      and not (
        (old.stage = 'draft' and new.stage = 'proposal')
        or (old.stage = 'active' and new.stage = 'complete')
        or (new.stage = 'hidden' and old.approved is distinct from true)
      ) then
      new.stage := old.stage;
    end if;
  end if;
  return new;
end;
$$;

alter table public.grant_agreements
  drop constraint if exists grant_agreements_approved_by_fkey;

alter table public.grant_agreements
  add constraint grant_agreements_approved_by_fkey
  foreign key (approved_by) references public.profiles(id) on delete set null;
