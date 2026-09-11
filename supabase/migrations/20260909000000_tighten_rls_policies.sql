-- Bids: was WITH CHECK (true) — any authenticated user could insert arbitrary
-- rows (any bidder, negative amounts) or rewrite their own row into one.
-- Negative pending bids read as positive spendable balance, so this was a
-- direct balance-minting hole via the public REST API.
drop policy "Enable insert for authenticated users only" on public.bids;
create policy "Users can insert their own bids" on public.bids
  for insert to authenticated
  with check (bidder = auth.uid() and amount >= 0 and valuation >= 0);

drop policy "Enable update for users based on user_id" on public.bids;
create policy "Users can update their own bids" on public.bids
  for update to authenticated
  using (bidder = auth.uid())
  with check (bidder = auth.uid() and amount >= 0);

-- stripe_txns are written only by the Stripe webhook via the service role.
drop policy "Enable insert for authenticated users only" on public.stripe_txns;

-- project_transfers are created only by the create_transfer_grant RPC and
-- admin-client scripts; a client-inserted row would let its author claim any
-- project by signing up with the row's recipient_email. The email column is
-- also hidden from the public keys (the app selects explicit columns).
drop policy "Enable insert for authenticated users only" on public.project_transfers;
revoke select on public.project_transfers from anon, authenticated;
grant select (id, project_id, recipient_name, transferred, created_at)
  on public.project_transfers to anon, authenticated;

-- Evals and trust rows: pin inserts to the caller (updates already were).
drop policy "Enable insert for authenticated users only" on public.project_evals;
create policy "Users can insert their own evals" on public.project_evals
  for insert to authenticated
  with check (evaluator_id = auth.uid());

drop policy "Enable insert for authenticated users only" on public.profile_trust;
create policy "Users can insert their own trust rows" on public.profile_trust
  for insert to authenticated
  with check (truster_id = auth.uid());

-- Former team members' personal Google accounts still had blanket UPDATE on
-- all projects.
drop policy "Enable update for rachel based on email" on public.projects;
drop policy "Enable update for saul based on email" on public.projects;
drop policy "Enable update for lily based on email" on public.projects;
