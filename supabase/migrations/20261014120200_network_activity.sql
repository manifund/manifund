-- Your network on home (docs/product/follows/README.md, F8, F10-F11): by project, who you follow did what there,
-- one row per project, person and kind, newest first. Runs as the caller (security invoker): their own follows
-- (follower_id = auth.uid()) and public projects, donations, offers and comments.
-- Replaces four queries that fetched every row (comment texts included) for the browser to group. Additive only.
create or replace function public.network_activity()
returns table (project_id uuid, name text, kind text, at timestamptz)
language sql stable security invoker set search_path = public as $$
  with followed as (select followed_id as id from profile_follows where follower_id = auth.uid()),
  events as (
    select p.id as project_id, p.creator as actor, 'created' as kind, p.created_at as at
      from projects p where p.creator in (select id from followed)
    union all
    select t.project, t.from_id, 'donated', t.created_at
      from txns t where t.from_id in (select id from followed) and t.type = 'project donation' and t.project is not null
    union all
    select b.project, b.bidder, 'offered', b.created_at
      from bids b where b.bidder in (select id from followed) and b.status = 'pending'
        and b.type in ('donate', 'assurance buy')
    union all
    select c.project, c.commenter, 'commented', c.created_at
      from comments c where c.commenter in (select id from followed) and c.deleted_at is null and c.project is not null
  )
  select e.project_id, coalesce(nullif(pr.full_name, ''), pr.username), e.kind, max(e.at)
  from events e
  join projects pj on pj.id = e.project_id and pj.stage in ('proposal', 'active', 'complete', 'not funded')
  join profiles pr on pr.id = e.actor
  group by e.project_id, pr.full_name, pr.username, e.kind
  order by max(e.at) desc
$$;
