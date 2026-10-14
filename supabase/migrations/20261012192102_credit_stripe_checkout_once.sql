-- The Stripe webhook credits a paid checkout session through credit_stripe_checkout: the deposit txn, its
-- stripe_txns record and the optional donation onward are written in one transaction, so a failure leaves nothing
-- behind and Stripe's next delivery of the event can simply retry. Each session is credited once: the function
-- returns false when the session is already recorded, and the unique index below settles two deliveries that
-- arrive at the same time (the second one rolls back and returns false).
-- Withdrawals also record Stripe transfer ids in stripe_txns.session_id; those are unique per transfer too.
-- One pair of rows from 2023 shares a session id, so the index covers rows from 2026-10-13 on; older sessions are
-- still caught by the function's check. Additive and re-runnable: apply before deploying the code that calls it.

create unique index if not exists stripe_txns_session_id_once
  on public.stripe_txns (session_id)
  where created_at >= '2026-10-13';

create or replace function public.credit_stripe_checkout(
  p_session_id text,
  p_user_id uuid,
  p_amount numeric,
  p_bank_id uuid,
  p_txn_id uuid,
  p_pass_funds_to uuid default null
) returns boolean
  language plpgsql
  set search_path = public
as $$
declare
  v_constraint text;
begin
  if exists (select 1 from stripe_txns where session_id = p_session_id) then
    return false;
  end if;
  insert into txns (id, amount, from_id, to_id, token, type)
    values (p_txn_id, p_amount, p_bank_id, p_user_id, 'USD', 'deposit');
  insert into stripe_txns (session_id, customer_id, txn_id, amount)
    values (p_session_id, p_user_id, p_txn_id, p_amount);
  if p_pass_funds_to is not null then
    insert into txns (amount, from_id, to_id, token, type)
      values (p_amount, p_user_id, p_pass_funds_to, 'USD', 'profile donation');
  end if;
  return true;
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'stripe_txns_session_id_once' then
    -- Another delivery of this session committed first; this one's inserts are rolled back.
    return false;
  end if;
  raise;
end;
$$;

revoke execute on function public.credit_stripe_checkout(text, uuid, numeric, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.credit_stripe_checkout(text, uuid, numeric, uuid, uuid, uuid) to service_role;
