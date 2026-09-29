-- POC comments, step 4 (design/comments-build.md, migration D). Additive only: new _v2 functions
-- beside the old ones (which other checkouts still call). The grant's money and project stay in one
-- transaction; the regrantor's rationale and the admin's note are no longer inserted here but
-- posted by lib/comments afterwards (kinds 'grant rationale' / 'admin note'), so every comment goes
-- through one writer and one notification path (decided 2026-09-28).
-- Production: replace the old functions with these bodies and drop the unused overloads
-- (supabase/prod-only/).

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
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, project.type, project.stage, project.round, project.slug, null, false, project.location_description, project.lobbying);

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
  values (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, project.type, project.stage, project.round, project.slug, null, false, project.location_description, project.lobbying);

  insert into project_transfers (recipient_email, recipient_name, project_id)
  values (project_transfer.recipient_email, project_transfer.recipient_name, project_transfer.project_id);

  insert into bids (project, amount, bidder, type, valuation)
  values (project.id, grant_amount, project.creator, 'donate', 0);

  insert into project_follows (project_id, follower_id) values (project.id, project.creator)
  on conflict do nothing;
end $$;

-- Called with the service role from the admin route (as the old one).
create or replace function public.execute_grant_verdict_v2(
  approved boolean, project_id uuid, admin_id uuid, public_benefit text default null)
returns void
language plpgsql
as $$
#variable_conflict use_variable
begin
  update projects
  set approved = approved, public_benefit = public_benefit
  where id = project_id;

  if not approved then
    perform reject_proposal(project_id);
  else
    update grant_agreements
    set approved_at = now(), approved_by = admin_id
    where grant_agreements.project_id = execute_grant_verdict_v2.project_id;
  end if;
end $$;

revoke execute on function public.execute_grant_verdict_v2(boolean, uuid, uuid, text)
  from public, anon, authenticated;
