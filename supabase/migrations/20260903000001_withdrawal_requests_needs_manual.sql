-- Wires to India and the Philippines need a regulatory purpose code (e.g. India's
-- P1302, "Personal gifts and donations"). Mercury's API has nowhere to carry it:
-- purpose.simple has 14 fixed categories and no code field, and
-- internationalWireRoutingInfo.countrySpecific collects an IFSC code / routing
-- number rather than a purpose. So those wires stay manual -- about six a year --
-- while everything else goes through the API.
--
-- A 'needs_manual' request still reserves the balance with a txns row like any
-- other; it just never gets a Mercury invite. It counts as open so the grantee
-- can't stack a second request on top of it, and mercury-sync no-ops on it
-- (no branch matches the status).

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check CHECK (status IN (
    'awaiting_recipient', 'ready_to_pay', 'pending_approval', 'needs_manual',
    'sent', 'failed', 'rejected'
  ));

DROP INDEX IF EXISTS withdrawal_requests_one_active_per_profile;
CREATE UNIQUE INDEX withdrawal_requests_one_active_per_profile
  ON public.withdrawal_requests (profile_id)
  WHERE status IN ('awaiting_recipient', 'ready_to_pay', 'pending_approval', 'needs_manual');

DROP INDEX IF EXISTS withdrawal_requests_open_idx;
CREATE INDEX withdrawal_requests_open_idx
  ON public.withdrawal_requests (status)
  WHERE status IN ('awaiting_recipient', 'ready_to_pay', 'pending_approval', 'needs_manual');
