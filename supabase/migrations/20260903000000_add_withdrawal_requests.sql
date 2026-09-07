-- Mercury-backed withdrawals: replaces the Airtable manual-withdrawal form for
-- large (>$10k) and international payouts. Stripe Connect is untouched and
-- remains the self-serve path for US withdrawals under $10k.
--
-- Grantees never send us bank details. They enter them on a Mercury-hosted
-- onboarding page reached through a recipient invite, and Manifund only ever
-- stores Mercury's opaque recipient id.
--
-- The balance is debited at REQUEST time with a real txns row -- same as the
-- Stripe path -- and that txn is DELETED if the request is later rejected or
-- the invite expires. withdrawal_requests keeps the audit trail either way, and
-- txn_id is ON DELETE SET NULL so a reversal is a single DELETE FROM txns.

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_recipient',

  mercury_invite_id text,
  mercury_recipient_id text,
  mercury_request_id text,
  mercury_transaction_id text,
  mercury_onboarding_url text,

  -- Generated once at request creation and reused on every retry of
  -- request-send-money. A timeout on that call leaves us unsure whether Mercury
  -- accepted it; replaying the same key is the only safe way to find out.
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),

  txn_id uuid REFERENCES public.txns(id) ON DELETE SET NULL,
  failure_reason text,
  feedback text,

  requested_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  sent_at timestamptz,
  last_nudged_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check CHECK (status IN (
    'awaiting_recipient', 'ready_to_pay', 'pending_approval',
    'sent', 'failed', 'rejected'
  ));

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_payment_method_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_payment_method_check
  CHECK (payment_method IN ('ach', 'internationalWire'));

-- At most one live request per person: blocks double-submits at the DB level,
-- keeps each person's balance reservation to a single row, and makes the
-- webhook's (recipient, amount) fallback match unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_one_active_per_profile
  ON public.withdrawal_requests (profile_id)
  WHERE status IN ('awaiting_recipient', 'ready_to_pay', 'pending_approval');

CREATE INDEX IF NOT EXISTS withdrawal_requests_open_idx
  ON public.withdrawal_requests (status)
  WHERE status IN ('awaiting_recipient', 'ready_to_pay', 'pending_approval');

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_mercury_request_id_idx
  ON public.withdrawal_requests (mercury_request_id)
  WHERE mercury_request_id IS NOT NULL;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner; /withdraw/request shows them their own status.
-- Every write goes through the service role, which bypasses RLS. Unlike txns,
-- this table is not world-readable -- it holds pending payment state.
DROP POLICY IF EXISTS "Users can view their own withdrawal requests"
  ON public.withdrawal_requests;
CREATE POLICY "Users can view their own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT USING (auth.uid() = profile_id);

-- Already present in prod, added out of band in Feb 2026. Its migration lives
-- only on the unmerged withdraw-mercury branch, so restate it here.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mercury_recipient_id text;

COMMENT ON COLUMN public.profiles.mercury_recipient_id IS
  'Mercury recipient id from a completed recipient invite. An opaque handle -- Manifund never stores routing or account numbers.';
