-- Rich profiles for the fictional test accounts (alice, bob, rita @local.test), so pages show what real profiles
-- have: a bio, an About text, a website, a project, donations and a balance. Layout and ordering problems then show
-- up in tests and screenshots (the user, 2026-10-01). Idempotent; touches only these three accounts and rows it
-- creates for them (marked "persona" in slugs and titles). Never run against production: tests refuse remote
-- databases, and the accounts don't exist there.

-- Profiles: bio, About, website (only filled when empty, so manual edits survive).
update public.profiles p set
  bio = coalesce(nullif(p.bio, ''), d.bio),
  website = coalesce(p.website, d.website),
  long_description = coalesce(p.long_description, jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', d.about))))))
from (values
  ('alice', 'Donor interested in evaluations and forecasting (test persona)', 'https://example.org/alice',
   'I give to early-stage AI safety and forecasting work, and like projects that publish their reasoning.'),
  ('bob', 'Builds tools for interpretability research (test persona)', 'https://example.org/bob',
   'I write small open-source tools that help researchers read model internals.'),
  ('rita', 'Regrantor (test persona)', 'https://example.org/rita',
   'I regrant in technical AI safety, mostly to individuals early in their careers.')
) as d(username, bio, website, about)
join auth.users u on u.email = d.username || '@local.test'
where p.id = u.id and p.username = d.username;

-- Balances: a deposit for alice and rita, so they can donate.
insert into public.txns (from_id, to_id, amount, token, type)
select null, p.id, d.amount, 'USD', 'deposit'
from (values ('alice', 5000), ('rita', 50000)) as d(username, amount)
join public.profiles p on p.username = d.username
join auth.users u on u.id = p.id and u.email = d.username || '@local.test'
where not exists (select 1 from public.txns t where t.to_id = p.id and t.type = 'deposit' and t.from_id is null);

-- A project for bob, active.
insert into public.projects (title, blurb, description, creator, slug, min_funding, funding_goal, founder_shares,
  type, stage, round, approved, signed_agreement, location_description)
select 'Persona project: interpretability notebooks', 'Notebooks that make model internals easier to read.',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A test persona''s project, local only."}]}]}'::jsonb,
  p.id, 'persona-bob-notebooks', 500, 5000, 10000000, 'grant', 'active', 'Regrants', true, true, 'Remote'
from public.profiles p join auth.users u on u.id = p.id and u.email = 'bob@local.test'
where not exists (select 1 from public.projects where slug = 'persona-bob-notebooks');

-- Donations to it from alice and rita (outgoing donations on their profiles, incoming on bob's project).
insert into public.txns (from_id, to_id, amount, token, type, project)
select p.id, pr.creator, d.amount, 'USD', 'project donation', pr.id
from (values ('alice', 250), ('rita', 1500)) as d(username, amount)
join public.profiles p on p.username = d.username
join auth.users u on u.id = p.id and u.email = d.username || '@local.test'
join public.projects pr on pr.slug = 'persona-bob-notebooks'
where not exists (select 1 from public.txns t where t.from_id = p.id and t.project = pr.id and t.type = 'project donation');
