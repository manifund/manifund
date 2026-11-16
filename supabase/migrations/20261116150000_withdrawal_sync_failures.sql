-- Consecutive mercury-sync failures for a request, so a brief Mercury outage
-- doesn't alert; reset on the next successful sync.
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS sync_failures integer NOT NULL DEFAULT 0;
