-- Donor survey: cause areas are now rated 1-5 stars instead of split by
-- percentage, and the funds-vs-direct slider moves in 5% steps.

ALTER TABLE public.donor_survey_responses
  DROP CONSTRAINT IF EXISTS donor_survey_responses_funds_vs_direct_check;
ALTER TABLE public.donor_survey_responses
  ADD CONSTRAINT donor_survey_responses_funds_vs_direct_check
  CHECK (funds_vs_direct IS NULL OR (funds_vs_direct BETWEEN 0 AND 100 AND funds_vs_direct % 5 = 0));

ALTER TABLE public.donor_survey_responses
  ADD COLUMN IF NOT EXISTS cause_ratings jsonb NOT NULL DEFAULT '[]';  -- [{ name, rating }], rating 1-5

ALTER TABLE public.donor_survey_responses
  DROP COLUMN IF EXISTS cause_allocation;
