-- The survey's "where have you already given" question has a second input
-- for a link to a giving history page, separate from the free text.
ALTER TABLE public.donor_survey_responses
  ADD COLUMN IF NOT EXISTS already_given_link text;
