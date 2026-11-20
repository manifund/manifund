-- Autograntor results are public, like project_ai_evals (P21).
create policy "Anyone can view project autograntor evals" on public.project_autograntor_evals
  for select using (true);
