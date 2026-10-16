-- Only the server moves a project into a stage that follows an admin decision or a funding outcome
-- (active, not funded, back to proposal). People keep the moves the site offers them: publishing a draft as a
-- proposal, closing their active project (complete), and hiding their project.
-- For anyone but the server: on insert, a project starts as a draft or a proposal (any other stage becomes
-- proposal); on update, any other change of stage keeps the current stage, and the rest of the update applies.
-- The service role and security definer functions owned by postgres are unaffected: verdicts, activation,
-- auctions, project transfers, the admin's restore, and the routes that start or reactivate certificate
-- projects after their own checks all write the stage there.

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
        or new.stage = 'hidden'
      ) then
      new.stage := old.stage;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_project_stage on public.projects;
create trigger protect_project_stage
  before insert or update on public.projects
  for each row
  execute function public.protect_project_stage();

-- The regrant functions run as their owner, so the trigger doesn't apply to them: a regrant's new project is
-- always a grant proposal, whatever the caller sends. Otherwise unchanged from 20260930235920.
create or replace function public.give_grant_v2(project public.project_row, donation public.bid_row)
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
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, 'grant', 'proposal', project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into bids (project, amount, bidder, type, valuation)
  values (donation.project, donation.amount, donation.bidder, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, donation.bidder)
  on conflict do nothing;
end $$;

create or replace function public.create_transfer_grant_v2(
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
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, 'grant', 'proposal', project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into project_transfers (recipient_email, recipient_name, project_id)
  values (project_transfer.recipient_email, project_transfer.recipient_name, project_transfer.project_id);

  insert into bids (project, amount, bidder, type, valuation)
  values (project.id, grant_amount, project.creator, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, project.creator)
  on conflict do nothing;
end $$;
