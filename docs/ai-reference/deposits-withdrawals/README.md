# Deposits and withdrawals

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

How money enters Manifund (card deposits through Stripe, larger gifts by hand) and how people take their cash out
(Stripe Connect payouts, bank transfers through Mercury), plus moving cash to one's charity balance.

**Status of this doc (2026-10-08).** Written from the code and its history by an agent, not yet reviewed. Rules
describe what the product does today ("observed (code, 2026-10-08)"); where a rule says why, that's the agent's
reading of commits, PRs and code comments, a draft for the team to confirm. Nothing here was decided for this doc.

Related areas: balances and the ledger (`docs/ai-reference/ledger/`, rule letter L: what a txn is, how the charity
and cash balances are computed), admin tools (`docs/ai-reference/admin/`, M: an admin crediting a wire or DAF gift by
hand), dormant features (`docs/ai-reference/dormant/`, X: mana deposits).

## What it's for

- **Getting money in to give.** Donors put money on Manifund (by card, or by wire, crypto or a donor-advised fund
  for large gifts) and then give it to projects, regrantors or funds. Deposits are tax-deductible donations to
  Manifold for Charity, so deposited money can be given but never withdrawn.
- **Getting grants out.** Project creators withdraw what their projects received (their cash balance) to a bank
  account: instantly through Stripe for small US payouts, or through Manifund's bank, Mercury, for large or
  international ones, each payment approved by a person on the team.
- **Choosing to give instead.** Someone with cash can move it to their charity balance and give it on.

## How it's built

- **Every movement is a txn** (L1): a `deposit` from Manifund's bank account (`NEXT_PUBLIC_PROD_BANK_ID`) to the
  person, a `withdraw` from the person to the bank account, a `cash to charity transfer` from the person to
  themselves. Balances are computed from them (L5-L7); nothing here stores a balance.
- **Card deposits** (`pages/api/checkout-sessions.ts`, `components/deposit-buttons.tsx`): the deposit box asks the
  server for a Stripe Checkout session and sends the person to Stripe's page. Stripe then calls
  `pages/api/stripe-endpoints.ts` (a signed webhook), which records the deposit and emails a receipt. `stripe_txns`
  links each Stripe session (or, for Stripe payouts, transfer) to its txn.
- **Stripe Connect payouts** (`pages/api/create-connect-account.ts`, `pages/api/stripe-connect-withdraw.ts`,
  `app/withdraw/`): a person sets up a Stripe Express account once (its id is kept on their profile,
  `stripe_connect_id`); each withdrawal is a Stripe transfer to it.
- **Mercury bank payouts** (`app/api/mercury-withdraw`, `app/withdraw/request/`, `utils/mercury.ts`,
  `utils/mercury-withdrawals.ts`, `db/withdrawal-request.ts`): a withdrawal is a row in `withdrawal_requests` that
  moves through statuses. People enter their bank details on Mercury's own page (a "recipient invite"); Manifund
  keeps only Mercury's id for them (`profiles.mercury_recipient_id`), never account numbers. Payments wait in
  Mercury's approval queue for someone on the team. Mercury has no sandbox, so this only runs in production.
- **Keeping Mercury requests moving**: an hourly cron (`/api/mercury-sync`) polls Mercury and advances every open
  request; it's the source of truth. A daily cron (`/api/mercury-nudge`) reminds people who haven't entered their
  bank details. Mercury's webhook (`pages/api/mercury-endpoints.ts`) only catches what polling can't see: a payment
  the receiving bank returned. All three share one state machine (`utils/mercury-withdrawals.ts`), so they agree on
  what each transition means.
- **Moving cash to charity**: `pages/api/move-cash-to-charity.ts`, from the profile's balance box.
- **Alerts to the team** go to a Discord channel (`utils/discord.ts`); emails to people go through Postmark.
- **Reconciliation** (`tools/recon/`, a local tool for the team): matches Stripe and Mercury exports against the
  `deposit` and `withdraw` txns.

### A Mercury withdrawal's statuses

```
awaiting_recipient ──invite completed──> ready_to_pay ──queued in Mercury──> pending_approval ──approved──> sent
        │                                     │                                    └──rejected/cancelled──> rejected
        └──invite expired──> failed           └──India/Philippines──> needs_manual ──wire seen──> sent
                                                                       sent ──bank returned it──> failed
```

A returning person (a Mercury recipient on file) starts at `ready_to_pay`. "Open" means `awaiting_recipient`,
`ready_to_pay`, `pending_approval` or `needs_manual`.

## Rules

### Deposits

- **W1** A signed-in person deposits by card through Stripe Checkout, always into their own account: the server
  credits whoever is signed in, never an id sent with the request. The server accepts an amount above $0 and up to
  $1,000,000; the deposit box asks for $10 to $50,000. Observed (code, 2026-10-08).
- **W2** A deposit is credited only when Stripe's signed webhook says the checkout session completed and is paid;
  a session that completed without payment yet (delayed payment methods) records nothing, and a request without a
  valid Stripe signature is refused and records nothing. Observed (code, 2026-10-08).
- **W3** A credited deposit is a `deposit` txn from Manifund's bank account to the person, for the amount Stripe
  actually charged (whatever amount the session was created with), plus a `stripe_txns` row linking the Stripe
  session to that txn. A session that charged nothing records nothing. Observed (code, 2026-10-08).
- **W4** Deposited money goes to the charity balance (L6): it can be given, not withdrawn, and the deposit box says
  so. Observed (code, 2026-10-08).
- **W5** Giving by card straight to an account: on a fund's or cause's donate section and the donate page (general
  regranting), the card payment is deposited to the payer as in W3 and then passed on as a `profile donation` of the
  same amount to that account. Observed (code, 2026-10-08).
- **W6** Larger gifts (wire, ACH, crypto, donor-advised funds) go through forms outside the site, and the team
  credits them by hand. The card deposit box points to that option
  from $10,000 up (lower fees). Observed (code, 2026-10-08).
- **W7** Stripe records (`stripe_txns`) aren't readable or writable from browsers, signed in or not; only server
  code writes them. Observed (code, 2026-10-08).

### Withdrawals, both ways

- **W8** Only the cash balance can be withdrawn (L7). `/withdraw` offers Stripe Connect ("Small & US", up to
  $10,000) and a bank transfer through Mercury ("Large or international"). Observed (code, 2026-10-08).
- **W9** A withdrawal is recorded as a `withdraw` txn from the person to Manifund's bank account before any money is
  sent, so the amount is reserved while the payout is in flight (days, for Mercury) and can't be spent or withdrawn
  the other way meanwhile. The server then recomputes the cash balance; if it went below zero (two withdrawals at
  once), it deletes its txn and refuses ("another withdrawal is already in progress"). Observed (code, 2026-10-08).
- **W10** A withdrawal that will never be paid gives the money back by deleting its `withdraw` txn (not by adding a
  deposit, which would look like a donation in receipts and reports). Observed (code, 2026-10-08).

### Stripe Connect

- **W11** A signed-in person sets up a Stripe Express account with their email; its id is saved on their profile and
  they're sent to Stripe's onboarding. Observed (code, 2026-10-08).
- **W12** A Stripe withdrawal needs a signed-in person, a Stripe account with payouts enabled and details submitted,
  and an amount within their cash balance; otherwise it's refused with a message saying which. Observed (code,
  2026-10-08).
- **W13** A Stripe withdrawal sends a Stripe transfer of the amount to the person's account and records a
  `stripe_txns` row with the transfer and the txn. If the transfer fails, the txn is deleted (W10), the team is
  alerted, and the person sees an error. Observed (code, 2026-10-08).

### Mercury bank transfers

- **W14** Mercury withdrawals run only in production, with Mercury's keys set: any other environment refuses them,
  because there is no Mercury sandbox and a dev server must never move money. A switch (`MERCURY_ENABLED`, on since
  2026-09-08) can limit them to admins. Observed (code, 2026-10-08).
- **W15** The amount, rounded to cents, must be at least $1,000, or the whole withdrawable balance when that's less,
  and at most the cash balance; someone with no cash balance is told there's nothing to withdraw. Observed (code,
  2026-10-08).
- **W16** One Mercury withdrawal open per person at a time: a second request is refused until the first is sent or
  reversed, and the database refuses a second open request too. Finished requests (sent, failed, rejected) don't
  count. Observed (code, 2026-10-08).
- **W17** First-time withdrawers choose US (ACH) or international (wire) and enter their bank details on Mercury's
  page; Mercury emails them the link and the page links it too. Someone with a Mercury recipient on file skips
  this: the request goes straight to payment, with the method that recipient was set up with (when an earlier
  request shows it), whatever the browser sent. Observed (code, 2026-10-08).
- **W18** People can read their own withdrawal requests (the page shows their status), nobody else's, and can't
  create or change them from the browser; only server code does. Observed (code, 2026-10-08).
- **W19** Once bank details are in, the payment is queued in Mercury for a person on the team to approve
  (`pending_approval`), and the person is emailed that it's queued. Each request keeps one idempotency key, reused
  on every retry, so a retried submission can't pay twice; the payment carries a note `mfw:<request id>` that links
  Mercury's transaction back to it. Observed (code, 2026-10-08).
- **W20** Wires to India and the Philippines need a regulatory purpose code that Mercury's API can't send: those
  requests become `needs_manual`, the team is alerted to send the wire from Mercury's dashboard, and the sync marks
  the request sent when it finds exactly one outgoing payment of that amount to that recipient since the request.
  Two or more matches: the team is alerted and nothing is guessed. Observed (code, 2026-10-08).
- **W21** Outcomes: approved in Mercury → `sent` (with when) and the person is emailed; rejected or cancelled in
  Mercury → `rejected`; the invite expired without bank details → `failed`; the receiving bank returned the payment
  → `failed`. Rejected and failed requests give the money back (W10), keep the reason, and the person is told they
  can ask again. Observed (code, 2026-10-08).
- **W22** Each transition happens once: it applies only if the request is still in the status it started from, so
  two syncs, or a sync and the webhook, at the same time don't email twice or give money back twice. A request
  already reversed is never turned back into `sent` (the team is alerted to reconcile by hand). Observed (code,
  2026-10-08).
- **W23** The hourly sync (cron only, with the cron secret) advances every open request; the withdrawal page also
  asks it to refresh the signed-in person's own request (only theirs) while it waits for bank details. Observed
  (code, 2026-10-08).
- **W24** Reminders: someone who hasn't entered bank details 24 hours after asking is emailed, then at most every 3
  days until the invite expires; a request waiting for approval or a manual wire for 2 days or more alerts the team,
  at most every 3 days. Observed (code, 2026-10-08).
- **W25** Mercury's webhook is refused unless signed with the shared secret and timestamped within 5 minutes (the
  team is alerted); without a configured secret it answers 503. It acts only on payments that are marked sent,
  failed, returned or cancelled and match a request (by the note, else by recipient and amount when exactly one
  request fits); everything else on the account is ignored. When handling fails it answers with an error, so
  Mercury retries. Observed (code, 2026-10-08).

### Moving cash to charity

- **W26** A signed-in person can move part of their cash balance to their charity balance: at least $1 and at most
  their cash balance, recorded as a `cash to charity transfer` txn from them to themselves (L6, L7). It can't be
  undone, which the confirmation says. The profile offers it when the cash balance is above zero. Observed (code,
  2026-10-08).

## Decisions

From the git history and PR descriptions; dated by commit, who made it as far as the commit shows. None of these
were reviewed for this doc.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-09-16 | Caroline (PR #253) | Mercury transitions are compare-and-swap; reusing an idempotency key recovers the already-queued payment (W19, W22) | Two overlapping syncs could both submit one payment |
| 2026-09-11 | Caroline (PR #243) | Checkout credits the signed-in caller; the webhook credits only paid sessions, for what Stripe charged (W1-W3) | Credit only what was paid, to the person signed in |
| 2026-09-08 | Caroline (commit) | Mercury withdrawals turned on for everyone (W14) | After a dark launch with admins only |
| 2026-09-07 | Caroline (PR #224, commits) | Mercury-backed withdrawals replace the Airtable manual-withdrawal form; Stripe Connect unchanged; bank details only on Mercury's page; balance reserved at request time and given back by deleting the txn (W9, W10, W14-W21) | A real status and `sent_at` for every withdrawal; Manifund never holds account numbers |
| 2026-09-07 | Caroline (PR #224) | Minimum Mercury withdrawal $1,000, capped at the balance (W15) | An international wire costs a flat $15, and small requests linger; nobody gets locked out |
| 2026-09-03 | Caroline (migration) | India and Philippines wires stay manual, about six a year (W20) | Mercury's API can't carry their purpose codes |
| 2026-09-07 | Caroline (commit) | Email people when their withdrawal is queued for approval (W19) | |
| 2026-08-13 | Caroline (PR #199) | Withdrawal errors shown to people; failed Stripe transfers alert the team (W12, W13) | Failures used to be an opaque 500 |
| 2026-04-07 | Austin (commit) | Stripe withdrawals: insert the txn first, then re-check the balance (W9) | Two withdrawals at once could both pass the balance check |
| 2024-09-13 | Austin (commit) | Wire/crypto/DAF instructions in the deposit box; card deposits capped at $50,000 in the box (W1, W6) | |
| 2024-02-17 | Austin (commit) | Card deposits of $10,000+ suggest a DAF, bank transfer or crypto (W6) | Lower fees |
| 2023-07-17 | Rachel (PR #51) | Cash can be moved to the charity balance (W26) | To give instead of withdrawing |
| 2023-07-04 | Rachel (commit) | Warnings for withdrawals over $10,000 (W8, W12) | |

## Open questions

- **Withdrawing everything under $1,000 can be refused** (W15). The minimum is computed on the raw balance, a sum
  of floats that can carry sub-cent dust (`app/api/mercury-withdraw/route.ts`), while the form floors the balance to
  cents (`withdraw-request-form.tsx`). With a balance of, say, $500.004, the form sends $500.00 and the server
  answers "Minimum Mercury withdrawal is $500.004". Fix: compute the minimum from the balance floored to cents.
- **A card payment "to an account" that fails to pass on** (W5): the `profile donation` insert in
  `pages/api/stripe-endpoints.ts:112` doesn't check for errors, so if it fails the payer keeps the money as their
  own deposit and nobody is told. Should it alert the team?
- **Moving cash to charity fails silently** (W26): the route answers errors with `NextResponse.error()` (an
  opaque failure on the edge runtime, see PR #199) and the profile's confirm button ignores the answer, closing the
  box either way.
- **Tax documents**: Mercury can collect a W-9/W-8BEN during onboarding (`MERCURY_REQUIRE_TAX_DOCUMENT`), off "until
  someone owning compliance says otherwise" (`utils/constants.ts:21`). Who decides?

## Later

- The `needs_manual` migration's comment (`20260903000001`) says such requests get no invite and the sync ignores
  them; both changed since. Worth a note if the migration is ever touched.

## Tests

Run locally: see `tests/ai-reference/README.md`. Each test names the rules it checks. Stripe and Mercury are never
called: keys are blank locally, and the in-process tests below answer for them.

- **Logic** (`tests/ai-reference/unit/deposits-withdrawals.test.ts`): W15 (the minimum), W20 (which recipients need
  a manual wire).
- **Database** (`tests/ai-reference/db/deposits-withdrawals.test.ts`, rolled back): W7, W10 (a reversed request
  keeps its record), W16, W18.
- **Webhooks and the Mercury state machine, in-process** (`tests/ai-reference/db/deposits-withdrawals-flows.test.ts`):
  the Stripe webhook and Mercury's code run in a child process against the local database, with Stripe's signature made
  locally and Mercury's answers faked; the test checks the txns and requests recorded. W2, W3, W5, W10, W17 (the
  known method), W19-W22, W25.
- **Routes** (`tests/ai-reference/routes/deposits-withdrawals.test.ts`): W1, W2, W4, W8, W11, W12, W14, W18,
  W23-W26, up to where Stripe or Mercury would be called, checking that nothing is recorded until then; moving cash
  to charity (W26) end to end.
- **Still to test** (`test.todo`, each with its reason): W9 and W13 (both payout routes stop before recording
  locally: Stripe's account lookup is blocked, Mercury refuses outside production), the success paths of W1, W11,
  W12 and W14, the crons' production behaviour (W23, W24), and what the deposit box asks in the browser (W1, W4,
  W6).
