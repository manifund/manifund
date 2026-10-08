-- Orgs can be hidden: kept in the table, off the directory, and their page a 404. Rules: docs/product/orgs/README.md.
--
-- Safe to apply before the code: one added column, false for every existing row.

alter table public.orgs
  -- Set by hand (scripts/orgs-seed.ts) for a page that isn't ready to show.
  add column hidden boolean not null default false;
