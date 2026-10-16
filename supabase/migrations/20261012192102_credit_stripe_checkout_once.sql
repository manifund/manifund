-- The Stripe webhook credits a paid checkout session through credit_stripe_checkout: the deposit txn, its
-- stripe_txns record and the optional donation onward are written in one transaction, so a failure leaves nothing
-- behind and Stripe's next delivery of the event can simply retry. Each session is credited once: deliveries of
-- the same session wait for each other (a transaction-scoped advisory lock on the session id), and the function
-- returns false when the session is already recorded.
-- Additive and re-runnable: apply before deploying the code that calls it.

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
begin
  perform pg_advisory_xact_lock(hashtextextended('stripe_checkout:' || p_session_id, 0));
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
end;
$$;

revoke execute on function public.credit_stripe_checkout(text, uuid, numeric, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.credit_stripe_checkout(text, uuid, numeric, uuid, uuid, uuid) to service_role;
