-- Activates a proposal with exactly the funding offers the app has just checked (utils/activate-project.ts):
-- `offers` is a JSON array of {id, amount}. Each one must still be a pending funding offer on this project with
-- that amount, and no other pending funding offer may have appeared since; otherwise nothing changes and the
-- function raises, and the next activation attempt (e.g. the next offer's webhook) checks again. It also refuses
-- a project that is no longer a proposal, so the same project can't be activated twice.
-- Same effects as activate_grant / activate_cert otherwise. Those two stay until the code no longer calls them.

create or replace function public.activate_proposal(project_id uuid, offers jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  proj record;
  funding_type bid_type;
  bid_row record;
  bundle_id uuid;
begin
  select p.id, p.creator, p.type, p.stage into proj
  from projects p
  where p.id = activate_proposal.project_id
  for update;
  if not found or proj.stage <> 'proposal' then
    raise exception 'activate_proposal: project % is not a proposal', activate_proposal.project_id;
  end if;
  funding_type := case when proj.type = 'grant' then 'donate'::bid_type else 'assurance buy'::bid_type end;

  perform 1 from bids b
  where b.project = proj.id and b.status = 'pending' and b.type = funding_type
  for update;

  if exists (
    -- a pending funding offer that wasn't checked, or whose amount changed
    select 1 from bids b
    where b.project = proj.id and b.status = 'pending' and b.type = funding_type
      and not exists (
        select 1 from jsonb_array_elements(activate_proposal.offers) o
        where (o ->> 'id')::uuid = b.id and abs(b.amount - (o ->> 'amount')::numeric) <= 0.005
      )
  ) or exists (
    -- a checked offer that is no longer pending
    select 1 from jsonb_array_elements(activate_proposal.offers) o
    where not exists (
      select 1 from bids b
      where b.id = (o ->> 'id')::uuid and b.project = proj.id and b.status = 'pending'
        and b.type = funding_type
    )
  ) then
    raise exception 'activate_proposal: offers on project % changed since they were checked', proj.id;
  end if;

  update projects set stage = 'active' where id = proj.id;

  for bid_row in
    select b.id, b.bidder, b.amount, b.valuation from bids b
    where b.project = proj.id and b.status = 'pending' and b.type = funding_type
  loop
    update bids set status = 'accepted' where id = bid_row.id;
    if proj.type = 'grant' then
      insert into txns (from_id, to_id, project, amount, token, type)
      values (bid_row.bidder, proj.creator, proj.id, bid_row.amount, 'USD', 'project donation');
    else
      bundle_id := gen_random_uuid();
      insert into txns (from_id, to_id, project, amount, token, bundle, type)
      values (bid_row.bidder, proj.creator, proj.id, bid_row.amount, 'USD', bundle_id, 'user to user trade');
      insert into txns (from_id, to_id, project, amount, token, bundle, type)
      values (proj.creator, bid_row.bidder, proj.id, bid_row.amount / bid_row.valuation * 10000000,
              proj.id, bundle_id, 'user to user trade');
    end if;
  end loop;

  if proj.type <> 'grant' then
    update bids set status = 'accepted'
    where project = proj.id and status = 'pending' and type = 'assurance sell';
  end if;
end;
$$;

-- Called only by the server (service role), like activate_grant and activate_cert.
revoke execute on function public.activate_proposal(uuid, jsonb) from public, anon, authenticated;
