-- Offers are created by the app's routes and changed afterwards only by the server (trades, activation,
-- closing, restoring a project), except for one thing people do with their own client: withdrawing a
-- pending offer, which sets its status to 'deleted' (db/bid.ts deleteBid).
-- For anyone but the server (service_role, postgres, supabase_admin):
--   on update, the row keeps all its current values, except that a pending offer may become 'deleted';
--   on insert, an offer starts pending and is dated now.
-- Every server-side writer uses the service role (handle-new-bid, resolve-auction, activation, closing,
-- restore-project, leo-grant-offer) or a security definer function owned by postgres (give_grant_v2,
-- create_transfer_grant_v2), so it's unaffected. Same pattern as protect_project_score_columns.
-- A column added to bids later is kept unchanged for people too, unless it's added here.

create or replace function public.protect_bid_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.created_at := now();
    elsif old.status = 'pending' and new.status = 'deleted' then
      new := old;
      new.status := 'deleted';
    else
      new := old;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_bid_columns on public.bids;
create trigger protect_bid_columns
  before insert or update on public.bids
  for each row
  execute function public.protect_bid_columns();
