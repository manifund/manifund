# Offers and activation

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

How money reaches a project that is still raising: people make **offers** (pledges) from their balance, and when
the project has reached its minimum, been approved and had its grant agreement signed, every offer becomes a
donation at once (the project is **activated**). If the project isn't funded, the offers are declined and no money
moves. Balances themselves (how a pending offer holds money aside) are in `../ledger/README.md`; closing proposals
past their deadline and restoring them are part of the project lifecycle.

**Status of this doc.** Written from the code on 2026-10-08 (backfill), not yet read by the team. Every rule below is
**observed (code, 2026-10-08)**: what the product does today, not a decision, except B20-B22, **decided (Vals,
2026-10-09; shipped in #289)**. "What offers are for" is a draft of the
intent, for the team to confirm. Suspected bugs are under "Open questions", not rules.

## What offers are for (draft, to confirm)

- **Assurance for donors.** "You're pledging to donate if the project hits its minimum goal and gets approved. If
  not, your funds will be returned" (the donate box). A donor's money only moves when the project can actually go
  ahead.
- **Assurance for creators.** A project starts only with at least its minimum funding, so it isn't left half-funded.
- **One moment of truth.** Activation is the single step where the offers turn into money, the project becomes
  active and the creator can withdraw.
- **Certificates** (impact certificates, dormant) used the same mechanism with "assurance buy" offers that buy
  shares; that part is described briefly here and in `../dormant/README.md`.

## How it's built

- **`bids` table**: one row per offer (`project`, `bidder`, `amount`, `valuation`, `type`, `status`). Types:
  `donate` (grants), `assurance buy` / `assurance sell` (certificate proposals), `buy` / `sell` (certificate trading).
  Statuses: `pending`, `accepted`, `declined`, `deleted`. An offer is not money: no `txns` row exists until
  activation.
- **Placing**: `pages/api/place-bid.ts` (Edge), called by the donate box on a grant proposal
  (`components/donate-box.tsx`), the org page's donate box (`app/orgs/[slug]/org-donate-box.tsx`) and the
  certificate buy box. It checks the person, the amount and their balance, then saves the offer. Donations to active projects don't use offers: they go straight
  through `transfer-money` (ledger).
- **Database webhook**: inserting a `bids` row calls `pages/api/handle-new-bid.ts` (in production a Supabase
  database webhook; a local database needs its own trigger for it). For a proposal it runs the
  activation check; for a certificate it matches trades (dormant); in both cases the bidder follows the project.
- **Activation check**: `maybeActivateProject` in `utils/activate-project.ts`. Also called after an admin's
  approval (`app/api/issue-grant-verdict/route.ts`) and after the grant agreement is signed
  (`utils/grant-agreement-write.ts`), so whichever of the three conditions is met last activates the project.
- **SQL functions** (one transaction each, so all-or-nothing): `activate_grant`, `activate_cert`, and
  `reject_proposal` (also run by `execute_grant_verdict_v2` when an admin rejects). They're for the server only
  (migration `20260911000000_secure_grant_rpcs.sql`).
- **Numbers**: `calcTotalOffered` / `calcFundingNeeded` (`utils/activate-project.ts`), `getAmountRaised`,
  `getMinIncludingAmm`, `getProposalValuation` (`utils/math.ts`).
- **Emails** on activation (donors, creator, followers) are sent by `activateProject` after the money has moved;
  they belong to the notifications doc, not to these rules.

## Rules

Observed (code, 2026-10-08). Ids are stable once merged.

### Placing an offer

- **B1** Offers are placed through `/api/place-bid` by a signed-in person (otherwise 401), with an amount above 0
  and a valuation of 0 or more, both finite numbers (otherwise 400, "Invalid amount"). A saved offer is answered
  with 200. Donation offers have type `donate` and valuation 0.
- **B2** A donation offer must fit the bidder's charity balance. Pending offers already count against the balance
  (`../ledger/README.md`). A larger offer is refused ("Insufficient funds", status 401) and nothing is saved.
- **B3** An offer on a project that doesn't exist is refused (404).
- **B4** A new offer is `pending`, saved as sent (amount, valuation, type), with the bidder being the signed-in
  person.
- **B5** On a grant proposal, the project page shows the donate box ("Offer to donate") while the amount offered is
  below the funding goal and no project transfer is pending; at the goal it says "Fully funded and not currently
  accepting donations." The box asks for at least $10 and at most the person's balance and what's left of the goal
  (B20, B22). After an offer, the page scrolls to the comments and the comment box
  asks "why did you donate?" (`../../product/comments/README.md` C29).
- **B6** Placing any offer makes the bidder follow the project (through the webhook).
- **B7** The webhook only acts on requests carrying the webhook secret (otherwise 401); with no secret configured it
  refuses everything.

### Limits on giving to a grant project

Decided (Vals, 2026-10-09: "if once fully funded it doesn't accept more donations, it also shouldn't accept anything
past the cap"; shipped in #289). One function holds them, used by the page and the server alike
(`utils/donation-limits.ts`), so both refuse the same amounts with the same words.

- **B20** A `donate` offer on a grant proposal must be at least $10 and at most what's left of the funding goal:
  the goal minus the pending `donate` offers (other people's included, since they hold the project's place until
  withdrawn or declined; a withdrawn offer frees its share). When less than $10 is left, exactly what's left is
  allowed, so a proposal can always reach its goal. Once nothing is left, offers are refused ("This project has
  reached its funding goal…"). A refused offer is answered 400 with the reason as text, and nothing is saved. The
  balance check (B2) comes first. Certificate offers (`assurance buy`, `buy`, `sell`) are not limited: certificates
  are dormant and their goal is a valuation, not a sum of donations.
- **B21** The same limits apply to a person's donation to a grant project through `transfer-money` (an active
  project), with what's left counted from the money the creator received for the project (as B16 shows it).
  Admins' transfers (admin page, "Create txn") skip them: they're manual corrections. Donations to a person or a
  fund (no project) aren't limited this way.
- **B22** The donate box shows what's left ("$X left to reach the funding goal.") and refuses, before sending, what
  the server would refuse; if the server still refuses (someone else's offer reached the goal in between), the box
  shows the server's reason instead of moving on to "why did you donate?". The org page's donate box does the same,
  and says "Fully funded" once nothing is left.

### Withdrawing an offer

- **B8** A bidder can withdraw their own offer (the Offers tab of the project, or their profile): it's marked
  `deleted`, which releases the money it held.

### Activation (grants)

- **B9** A grant proposal is ready when its pending `donate` offers add up to at least its minimum funding, an admin
  has approved it, and its creator has signed the grant agreement.
- **B10** The check runs after each new offer on a proposal, after an admin's verdict, and after the agreement is
  signed; whichever comes last activates the project.
- **B11** Activation (`activate_grant`) is one all-or-nothing step: the project becomes `active`, and every pending
  `donate` offer becomes `accepted` and a `project donation` txn of the same amount, in USD, from the donor to the
  creator, with the project set.
- **B12** The full amount of every pending offer moves, even when together they exceed the minimum or the funding
  goal.
- **B13** Each offer becomes money once: two activations running at the same time (two webhooks, a verdict and a
  signature) don't pay an offer twice.
- **B14** Only the server activates or declines offers: `activate_grant`, `activate_cert` and `reject_proposal` can't
  be called by signed-in people or visitors through the database API.

### When a proposal isn't funded

- **B15** `reject_proposal` declines every pending offer on the project (of any type) and sets the project to `not
  funded`. No txn is written: the offered money never left the donors' balances, so declining it is the refund. It
  runs when an admin rejects the proposal (`execute_grant_verdict_v2` with approved = false) and when a proposal
  passes its deadline below its minimum (the close-grants cron, project lifecycle).

### What the page shows

- **B16** While a project is a proposal, the amount raised is the sum of its pending `donate`, `buy` and `assurance
  buy` offers (declined, withdrawn and accepted offers don't count). Once active, it's what the creator received
  (`../ledger/README.md`). A `dummy` project shows its funding goal.
- **B17** The minimum shown for a grant is its minimum funding. For a certificate it also includes the share of the
  valuation reserved for the market maker (`amm_shares`).

### Certificates (dormant)

- **B18** A certificate proposal is ready, without approval or agreement, when its pending `assurance buy` offers add
  up to at least the creator's own `assurance sell` offer (with none, it needs nothing). Its valuation while a
  proposal is the minimum funding divided by the share investors get (all shares minus the founder's and the market
  maker's).
- **B19** Activating a certificate (`activate_cert`): the project becomes `active`; each pending `assurance buy`
  becomes `accepted` and two txns in one bundle: its amount in USD from the buyer to the creator, and
  amount ÷ valuation × 10,000,000 shares from the creator to the buyer (`user to user trade`); the creator's pending
  `assurance sell` becomes `accepted`. The server then seeds the market maker. Auctions (`resolveAuction`) are in the
  dormant doc.

## Decisions

From the code's history; the "why" comes from the PRs. Newest first.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-09 | Vals (#289) | Offers and donations to a grant project are capped at what's left of the funding goal, pending offers counting, and the server applies the $10 minimum and the cap (B20-B22; open question 3) | "If once fully funded it doesn't accept more donations, it also shouldn't accept anything past the cap"; one set of rules, wherever the offer comes from |
| 2026-10-08 | Vals (review) | The server applies the same limits as the donate box ($10 minimum; no offer past the funding goal), page and server aligned (open question 3). Whether a project may end up above its goal at all is for the team (B12) | One set of rules, wherever the offer comes from |
| 2026-09-11 | Team (#243) | Offers need a finite positive amount and a non-negative valuation (B1); activation and rejection functions only for the server (B14) | Input checks and server-only money functions |
| 2024-01-23 | Team (#78) | Donating, investing and commenting make you follow a project (B6) | Followers hear when the project moves stage |
| 2023-12-08 | Team | Certificate offers within $1 of the amount needed are rounded to fund the project exactly (see Open questions) | "floating point errors" (code comment) |
| 2023-10-10 | Team | New offers go through a database webhook (B10) | (No PR text; commit "new bid handler webhook") |
| 2023-06-16 | Team (#39) | A grant proposal activates when it has its minimum, approval and a signed agreement, checked whenever one of them changes; all donate offers become txns then (B9-B11) | Donors pledge; money moves only when the project can go ahead |

## Open questions

Found while writing this doc (2026-10-08). Vals reviewed them on 2026-10-08 (in brackets).

1. **Rounding of certificate offers looks inverted** (`pages/api/place-bid.ts:48-57`). The code means to round an
   `assurance buy` up when it leaves the project a few cents short, but it acts when the offer *overshoots* by less
   than $1, and then sets the amount to the (negative) overshoot. The insert is then refused by row-level security
   (amount ≥ 0), so the person gets an error (500) instead of an offer (seen in a route test). Certificates are
   dormant, so it may not matter. (Bug, to fix.)
2. **A second offer by the same person (or an offer by someone who already follows) made the webhook fail at the
   follow step** (until 2026-10-09): `follow_project` inserted without `on conflict`, so `handle-new-bid` answered
   500 after the offer was saved. Fixed (Vals 2026-10-09, found by the karma tests): `follow_project` ignores an
   existing follow (#291, migration `20261009140000`). Test in `tests/ai-reference/db/offers.test.ts` (B6).
3. **Limits only the page applied** (until 2026-10-09): the $10 minimum was in the donate boxes only, and nothing
   capped an offer at what's left of the goal. Decided (Vals 2026-10-09) and built in #289: B20-B22.
4. **"Insufficient funds" answers 401** (unauthorized) rather than 400 or 403. Callers only check `ok`, so changing
   it is cheap. (Bug, to fix, low priority.)
5. **The admin "Activate" button** (`app/admin/activate-project.tsx`) is disabled, with a note that it needs a
   hard-coded key; no page renders it (`../admin/README.md`). Activation needs no admin step beyond the verdict
   (B10). (Fine as is for now; it's dead code under the repo's habit, listed with the admin area's unused pieces.)

## Later

- Move the activation emails onto notifications.

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/offers.test.ts`): B9 and B18 (what counts toward the minimum), B16, B17, B18 (valuation).
- **Database** (`tests/ai-reference/db/offers.test.ts`): B8 (only the bidder withdraws an offer), B11, B12, B13 (two
  activations at once), B14, B15, B19, B6 (a repeat follow).
- **Logic** (`tests/ai-reference/unit/offers.test.ts`) also: B20-B22's limits (`utils/donation-limits.ts`).
