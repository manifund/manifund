-- Donor survey (manifund.org/donor-survey): one row per respondent.
--
-- Respondents are either signed in (profile_id set) or identified only by the
-- email they typed. Email-only respondents get an emailed edit link; as with
-- grant-agreement signing links, only the sha256 of that token is stored.
--
-- Every read and write goes through the service role from server code, which
-- also picks the columns that are safe to show on a published donor page. A
-- row-level "is_public" policy would leak email and edit_token_hash through
-- PostgREST, so RLS only lets the owner read their own row.

CREATE TABLE IF NOT EXISTS public.donor_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,

  -- Basic questions
  capacity text[] NOT NULL DEFAULT '{}',   -- own_money | grantmaker | regrantor
  org text,

  -- Giving questions
  giving_2026 text,                        -- band key, see db/donor-survey.ts
  giving_2027 text,                        -- band key or not_sure
  cause_allocation jsonb NOT NULL DEFAULT '[]',  -- [{ name, pct }], sums to 100
  advice_sources text,
  landscape_problems text,

  -- More giving questions (optional)
  funds_vs_direct integer CHECK (funds_vs_direct IS NULL OR funds_vs_direct IN (0, 25, 50, 75, 100)),
  already_given text,
  evaluation_approach text,
  charities_interested text,
  hours_per_month text,                    -- band key
  dream_setup text,

  -- Comms questions
  wants_opportunities boolean,
  opportunity_frequency text,              -- weekly | monthly | quarterly
  wants_call boolean NOT NULL DEFAULT false,
  wants_events boolean NOT NULL DEFAULT false,
  share_with_funders boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT false,

  -- Misc
  other_thoughts text,
  referrals text,

  edit_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One response per person, whether they signed in or only typed an email.
CREATE UNIQUE INDEX IF NOT EXISTS donor_survey_responses_profile_id_idx
  ON public.donor_survey_responses (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donor_survey_responses_email_idx
  ON public.donor_survey_responses (lower(email));

CREATE INDEX IF NOT EXISTS donor_survey_responses_public_idx
  ON public.donor_survey_responses (is_public)
  WHERE is_public;

ALTER TABLE public.donor_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own donor survey response"
  ON public.donor_survey_responses;
CREATE POLICY "Users can view their own donor survey response"
  ON public.donor_survey_responses FOR SELECT USING (auth.uid() = profile_id);
