-- Claude's evaluation of each project: a 1-5 merit score, the probability it reaches its
-- minimum funding, and a short opinion. Rows are never overwritten: one per (text, prompt,
-- model), so the evaluation made when a proposal was posted survives later edits.
-- (project_evals is the older human evaluation form, unrelated.)
create table public.project_ai_evals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_version text not null,
  model text not null,
  -- Hash of the exact input the model saw, so an edit gets a new row
  content_hash text not null,
  -- Stage when evaluated: tells a posting-time forecast from a later rescore
  project_stage text not null,
  score smallint check (score between 1 and 5),
  p_min_funding numeric check (p_min_funding between 0 and 1),
  opinion text,
  outcome_leaked boolean,
  -- Set instead of the fields above when the model declines; kept so it isn't retried
  error text,
  raw jsonb,
  cost_usd numeric,
  created_at timestamptz not null default now(),
  unique (project_id, prompt_version, model, content_hash),
  check ((error is null) = (score is not null and p_min_funding is not null))
);

create index project_ai_evals_project_created_idx
  on public.project_ai_evals (project_id, created_at desc);

alter table public.project_ai_evals enable row level security;

create policy "Anyone can view project AI evals" on public.project_ai_evals
  for select using (true);
