-- Autograntor runs: the expected utility of funding a project at a few amounts, in milestone points (Plan A
-- US-China pause = 1,000,000), with the full report and the ledger it was simulated from. Run by hand from
-- tools/autograntor; rows are never overwritten.
create table public.project_autograntor_evals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_version text not null,
  milestones_version text not null,
  models text not null,
  -- [{amount, mean, median, p10, p90, p_negative, post2030_share}], amounts in dollars, values in points
  results jsonb not null,
  report_md text not null,
  ledger_csv text not null,
  -- Hash of the application text the estimators saw
  project_content_hash text not null,
  created_at timestamptz not null default now()
);

create index project_autograntor_evals_project_created_idx
  on public.project_autograntor_evals (project_id, created_at desc);

-- Only the service role writes; reads are opened in 20261121010000_autograntor_evals_public.sql.
alter table public.project_autograntor_evals enable row level security;
