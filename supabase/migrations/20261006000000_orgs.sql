-- Org pages (manifund.org/orgs/<slug>): a curated directory of organizations donors can read about and give to.
-- Plan: docs/plans/org-profiles-2026-10-06.md.
--
-- Safe to apply before the code: nothing on main reads or writes public.orgs.
--
-- What lives where:
-- * public.orgs is what Manifund says about an org: its page's identity, the words we (later, the org) write, its
--   legal identity, its donation link, and its Manifund projects. Written by hand or by a seed script.
-- * trace.* is what public sources say: grants in and out, team, third-party reviews, former names. Written by
--   Trace's ingestion scripts and read live by the org page. Nothing from Trace is copied here.

-- 1. Replace the old public.orgs: five rows from a January 2026 experiment, no migration, no code that uses it, and
-- no row level security (anyone with the public key could rewrite it). Its words carry over; headcount now comes
-- from trace.org_teams, and target_2026, budget_url, email and tags are dropped.
create temp table orgs_old as select * from public.orgs;
drop table public.orgs;

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  -- The page's address: /orgs/metr. Ours to choose, and unrelated to Trace's slug for the same org.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- The name people use: "METR", not "Model Evaluation and Threat Research, Inc."
  name text not null,
  logo_url text,
  website text,
  -- One line, shown under the name and on cards.
  summary text,
  -- A paragraph or so, as the editor's JSON document (Tiptap), like projects.description.
  about jsonb,

  -- Legal identity: who a donation actually goes to. Null where we haven't checked, and for a project with no
  -- entity of its own.
  legal_name text,
  legal_structure text check (
    legal_structure in ('501c3', '501c4', 'c_corp', 'pbc', 'llc', 'non_us', 'other')
  ),
  -- US employer identification number, digits only. Public (it's on every Form 990), and the key for looking the
  -- org up anywhere else.
  ein text check (ein ~ '^[0-9]{9}$'),
  -- Where it's established: ISO 3166-1 alpha-2 country, and for the US the two-letter state.
  country text check (country ~ '^[A-Z]{2}$'),
  us_state text check (us_state ~ '^[A-Z]{2}$'),

  -- The org's own donation page elsewhere, if any. Raising money through Manifund is a project in org_projects
  -- (below), not a column here: an org can have several at once. Neither: listed, not fundraising here.
  donation_url text,

  -- This org's row in trace.orgs, by slug. One entity: where Trace has several rows for the same org, they get
  -- merged on the Trace side. By slug and without a foreign key, because Trace merges and rebuilds its rows and
  -- must stay free to.
  trace_slug text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.orgs (slug, name, summary, about, website, logo_url, donation_url, created_at)
select
  slug,
  name,
  subtitle,
  -- Plain text to an editor document: one paragraph per non-empty line.
  (
    select jsonb_build_object('type', 'doc', 'content', jsonb_agg(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', btrim(line))
      ))
      order by n
    ))
    from regexp_split_to_table(description, E'\n') with ordinality as t (line, n)
    where btrim(line) <> ''
  ),
  website,
  logo_url,
  donation_url,
  created_at
from orgs_old;

drop table orgs_old;

-- Everyone reads; only server code with the service role writes.
alter table public.orgs enable row level security;
create policy "Enable read access for all users" on public.orgs for select using (true);

-- 2. An org's projects on Manifund: what it's raising for now (e.g. "Lightcone general operations", or Lighthaven
-- and LessWrong separately) and its past proposals. Whether anyone from the org has an account doesn't matter. The
-- page offers donating to the ones open for funding, which the project's own stage says. A table rather than a
-- column on projects, because creators can update their own project row and must not be able to put a project on
-- METR's page. One org per project.
create table public.org_projects (
  project_id uuid primary key references public.projects (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index org_projects_org_idx on public.org_projects (org_id);

alter table public.org_projects enable row level security;
create policy "Enable read access for all users" on public.org_projects for select using (true);
