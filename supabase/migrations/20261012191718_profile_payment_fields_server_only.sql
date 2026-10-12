-- Only the server sets the profile fields that decide what money someone holds and where it's paid:
-- accreditation (which balances count as withdrawable), regrantor status, account type, and the
-- Stripe and Mercury payout accounts. People keep editing the rest of their profile from the site.
-- For anyone but the server, an update keeps these columns at their current values whatever it
-- carries (the edit-profile form sends regranter_status unchanged, which still saves). Same pattern
-- as protect_profile_karma_columns. Profiles are created by the sign-up trigger, so insert is
-- unaffected.

create or replace function public.protect_profile_payment_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.accreditation_status := old.accreditation_status;
    new.regranter_status := old.regranter_status;
    new.type := old.type;
    new.stripe_connect_id := old.stripe_connect_id;
    new.mercury_recipient_id := old.mercury_recipient_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_payment_columns on public.profiles;
create trigger protect_profile_payment_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_payment_columns();
