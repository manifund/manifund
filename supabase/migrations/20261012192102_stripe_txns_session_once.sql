-- Each Stripe checkout session (or transfer) is recorded once. The webhook handler checks first and
-- undoes its credit if this index refuses a second row for the same session.
-- One pair of rows from 2023 shares a session id, so the index covers rows from now on only.
create unique index if not exists stripe_txns_session_id_once
  on public.stripe_txns (session_id)
  where created_at >= '2026-10-13';
