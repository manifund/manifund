-- The org directory (/orgs): what it filters and tags orgs by. Rules: docs/product/orgs/README.md.
--
-- Safe to apply before the code: two added columns and one check loosened.

alter table public.orgs
  -- The one cause the org is listed under, as shown: "AI safety". The list lives in the code
  -- (utils/org-directory.ts) while it's a handful of values; unrelated to projects' causes.
  add column cause text,
  -- What kind of work it does, as shown: "Evals", "Field-building". Several per org.
  add column focus text[] not null default '{}';

-- An org with no entity of its own, run under a sponsor's: its legal_name and ein are the sponsor's.
alter table public.orgs
  drop constraint orgs_legal_structure_check,
  add constraint orgs_legal_structure_check check (
    legal_structure in ('501c3', '501c4', 'c_corp', 'pbc', 'llc', 'non_us', 'fiscally_sponsored', 'other')
  );
