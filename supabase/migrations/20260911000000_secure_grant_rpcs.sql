-- These RPCs are invoked only via the service role (webhooks, cron), which
-- bypasses RLS; ordinary users must not be able to call them through
-- PostgREST at all.
do $$
declare fn record;
begin
  for fn in
    select oid::regprocedure as sig from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('_transfer_project', 'activate_grant', 'activate_cert', 'reject_proposal')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- create_transfer_grant is called with the regranter's own client, and its
-- project_transfers insert stops passing RLS once the open INSERT policy is
-- dropped (20260909000000). It becomes SECURITY DEFINER with explicit caller
-- checks instead of relying on caller RLS. Body otherwise unchanged.
create or replace function public.create_transfer_grant(project project_row, donor_comment comment_row, project_transfer transfer_row, grant_amount numeric)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
BEGIN
  IF auth.uid() IS NULL
     OR project.creator IS DISTINCT FROM auth.uid()
     OR donor_comment.commenter IS DISTINCT FROM auth.uid()
     OR grant_amount IS NULL
     OR grant_amount < 0 THEN
    RAISE EXCEPTION 'create_transfer_grant: caller mismatch or invalid amount';
  END IF;

  INSERT INTO projects (id, creator, title, blurb, description, min_funding, funding_goal, founder_shares, type, stage, round, slug, approved, signed_agreement, location_description, lobbying)
  VALUES (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, project.type, project.stage, project.round, project.slug, null, false, project.location_description, project.lobbying);

  INSERT INTO comments (id, project, commenter, content)
  VALUES (donor_comment.id, donor_comment.project, donor_comment.commenter, donor_comment.content);

  INSERT INTO project_transfers(recipient_email, recipient_name, project_id)
  VALUES (project_transfer.recipient_email, project_transfer.recipient_name, project_transfer.project_id);

  INSERT INTO bids (project, amount, bidder, type, valuation)
  VALUES (project.id, grant_amount, project.creator, 'donate', 0);

  EXECUTE(follow_project(project.id, project.creator));
END;
$function$;

-- give_grant creates the project with creator = the grant RECIPIENT, so it
-- cannot pass a creator-pinned projects INSERT policy as invoker; it becomes
-- SECURITY DEFINER with the caller pinned to the donation/comment instead.
-- (project.creator is intentionally unchecked: it names the recipient.)
create or replace function public.give_grant(project project_row, donor_comment comment_row, donation bid_row)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
BEGIN
  IF auth.uid() IS NULL
     OR donation.bidder IS DISTINCT FROM auth.uid()
     OR donor_comment.commenter IS DISTINCT FROM auth.uid()
     OR donation.amount IS NULL
     OR donation.amount < 0 THEN
    RAISE EXCEPTION 'give_grant: caller mismatch or invalid amount';
  END IF;

  INSERT INTO projects (id, creator, title, blurb, description, min_funding, funding_goal, founder_shares, type, stage, round, slug, approved, signed_agreement, location_description, lobbying)
  VALUES (project.id, project.creator, project.title, project.blurb, project.description, project.min_funding, project.funding_goal, project.founder_shares, project.type, project.stage, project.round, project.slug, null, false, project.location_description, project.lobbying);

  INSERT INTO bids (project, amount, bidder, type, valuation)
  VALUES (donation.project, donation.amount, donation.bidder, 'donate', 0);

  INSERT INTO comments (id, project, commenter, content)
  VALUES (donor_comment.id, donor_comment.project, donor_comment.commenter, donor_comment.content);

  EXECUTE(follow_project(project.id, donor_comment.commenter));
END;$function$;

-- Anyone authenticated could insert projects with an arbitrary creator id;
-- every legitimate flow inserts creator = the caller.
drop policy "Enable insert for authenticated users only" on public.projects;
create policy "Users can insert their own projects" on public.projects
  for insert to authenticated
  with check (creator = auth.uid());
