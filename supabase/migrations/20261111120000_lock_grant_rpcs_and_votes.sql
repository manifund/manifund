-- Grant RPCs are SECURITY DEFINER and callable through the REST API, so they check everything the
-- create-grant route checks: only regrantors give grants, for a positive amount, and the bid and the
-- pending transfer both belong to the project being created (an unchecked transfer.project_id let
-- anyone plant a transfer on someone else's project and claim it at sign-up). Definer functions skip
-- refuse_held_projects, so held accounts are refused here too.

create or replace function public.give_grant_v2(project project_row, donation bid_row)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null
     or donation.bidder is distinct from auth.uid()
     or donation.project is distinct from project.id
     or donation.amount is null
     or donation.amount <= 0
     or not exists (select 1 from profiles where id = auth.uid() and regranter_status) then
    raise exception 'give_grant_v2: caller mismatch or invalid amount';
  end if;
  if public.is_held(auth.uid()) or public.is_held(project.creator) then
    raise exception 'account pending review' using errcode = 'P0001';
  end if;

  insert into projects (id, creator, title, blurb, description, min_funding, funding_goal, founder_shares, type, stage, round, slug, approved, signed_agreement, location_description, lobbying)
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, 'grant', 'proposal', project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into bids (project, amount, bidder, type, valuation)
  values (project.id, donation.amount, donation.bidder, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, donation.bidder)
  on conflict do nothing;
end $function$;

create or replace function public.create_transfer_grant_v2(project project_row, project_transfer transfer_row, grant_amount numeric)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null
     or project.creator is distinct from auth.uid()
     or project_transfer.project_id is distinct from project.id
     or grant_amount is null
     or grant_amount <= 0
     or not exists (select 1 from profiles where id = auth.uid() and regranter_status) then
    raise exception 'create_transfer_grant_v2: caller mismatch or invalid amount';
  end if;
  if public.is_held(auth.uid()) then
    raise exception 'account pending review' using errcode = 'P0001';
  end if;

  insert into projects (id, creator, title, blurb, description, min_funding, funding_goal, founder_shares, type, stage, round, slug, approved, signed_agreement, location_description, lobbying)
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, 'grant', 'proposal', project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into project_transfers (recipient_email, recipient_name, project_id)
  values (project_transfer.recipient_email, project_transfer.recipient_name, project.id);

  insert into bids (project, amount, bidder, type, valuation)
  values (project.id, grant_amount, project.creator, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, project.creator)
  on conflict do nothing;
end $function$;

-- Votes: one per person per project, worth -1, 0 or 1, cast only as yourself. Duplicates (double-click
-- races) keep the latest row.
delete from project_votes v
using project_votes newer
where newer.voter_id = v.voter_id and newer.project_id = v.project_id and newer.id > v.id;

alter table project_votes
  add constraint project_votes_voter_project_key unique (voter_id, project_id),
  add constraint project_votes_magnitude_check check (magnitude in (-1, 0, 1));

drop policy "Enable insert for authenticated users only" on project_votes;
create policy "Users can insert their own votes" on project_votes
  for insert to authenticated with check (voter_id = auth.uid());
