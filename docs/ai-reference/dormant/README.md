# Dormant features

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

Features Manifund built and used, mostly in 2023-2024, that nobody uses any more but whose code still runs:
impact certificates (and their trading, market maker and auctions), mana deposits, and grant evaluations. This doc
says what each was, when it was last used, what can still be reached today, and what live code still depends on it.
It is short on purpose: rules only cover what can still be reached and matters; code nobody can reach is an open
question ("delete it?"), not a rule.

**Status of this doc.** Written from the code and its history on 2026-10-08 (backfill), not yet read by the team.
Every rule is **observed (code, 2026-10-08)**: what the product does today, not a decision. Last-use dates come from
production's data (as of 2026-10-06). Neighbours: offers on certificates and their activation
(`../offers/README.md`, B16-B19), how trades and mana count in balances (`../ledger/README.md`, L6, L9),
programs with certificate settings (`../causes/README.md`, R9, R11).

## What they were, and when they were last used

| Feature | What it was | Built | Last used |
|---|---|---|---|
| **Impact certificates** | A project sold shares of itself instead of asking for donations: investors bought shares (first as "assurance buy" offers while it was a proposal), and could later sell them to a prize funder or to each other. Projects of type `cert`, in prize programs (ACX Mini-Grants, OP AI Worldviews, ChinaTalk, Manifold Community Fund, ACX Grants 2024) | 2023-02 | Last certificate created 2024-03-08 (a draft); last activated 2024-04-05 |
| **Trading** | Buying and selling certificate shares: limit orders (`buy`/`sell` offers at a valuation), matched against each other, or accepted from the Offers tab | 2023-03 | Last trade 2025-05-20; last new offer 2025-05-20 |
| **Market maker (AMM)** | A constant-product market maker per certificate (Uniswap-style), seeded with shares and dollars, so people could trade at any time. It has its own profile (type `amm`, username `<slug>-amm`, same id as the project) | 2023-11 (#66) | Last trade with it 2024-03-27; 6 certificates have one, all complete |
| **Auctions** | For programs with `auction` on (ACX Grants 2024), offers on a certificate proposal were resolved at the close date into one valuation | 2023-02, reworked 2024-04 (#132) | Last resolved 2024-04 |
| **Mana deposits** | Turning Manifold mana into Manifund charity balance: the person gave their Manifold API key, Manifund sent their mana to its own Manifold account and credited them (1,000 mana = $1 since 2024-06) | 2023-11 (#69) | Last deposit 2024-09-13, the day the option was removed from the deposit dialog |
| **Grant evaluations** | An experimental form to sort grants into tiers, with confidence, and to say how much one trusts other evaluators; results per evaluator at `/<username>/evals` (#65) | 2023-10 | 80 evaluations and 7 trust rows, all 2023-10-03 to 2023-10-07 |

## What can still be reached today

- **Certificate project pages.** 79 certificates are `active` or `complete`. Their pages still show the trade box,
  the Offers tab (buy and sell offers, with a button to accept one), the Shareholders tab and, for those with a
  market maker, the valuation chart (X2). Some pending buy and sell offers are still open on them; pending buy
  offers hold their bidders' charity balance (L9).
- **The trade routes**: `/api/trade-with-amm` and `/api/trade-with-limit` (X5, X6), and the new-offer webhook,
  which matches a new buy or sell offer on an active certificate (X7).
- **No new certificates.** Every program with certificate settings (`cert_params`) is closed (R9). A program with
  certificate settings would make new projects certificates again (R11).
- **Every new project still gets shares** (X1): a leftover of certificates that live code still runs.
- **`/evals-form` and `/<username>/evals`** still work by URL; nothing links to them (X11, X12).
- **`/about/impact-certificates`** (an explanation of certificates and an auction playground) is linked from the
  About page, from a program's Impact certificates tab, and from certificate project pages. The About page's
  numbers count past trades.
- **Elsewhere**: the public API and MCP server list the certificate txn types (`../api/`); the admin page has a
  "give creator shares" tool (`../admin/`); balances count trade and mana txns (L6).

## How it's built

- **Shares are txns** whose `token` is the project's id (USD txns have `USD`). 10,000,000 shares per project
  (`TOTAL_SHARES`). A trade is two txns sharing a `bundle`: shares one way, dollars the other (`makeTrade`,
  `utils/trade.ts`). Types: `mint cert`, `user to user trade`, `user to amm trade`, `inject amm liquidity`.
- **Offers** to trade are `bids` rows of type `buy` or `sell` with a valuation (`../offers/README.md`).
- **The market maker**: pricing in `utils/amm.ts`; seeded by `seedAmm` (`utils/activate-project.ts`).
- **Auctions**: `utils/resolve-auction.ts`, run by the close-grants cron and by the activation check for
  certificates in an auction program.
- **Pages**: `app/projects/[slug]/trade.tsx`, `bids.tsx`, `shareholders.tsx`, `valuation-chart.tsx`,
  `app/about/impact-certificates/`, `app/evals-form/`, `app/[usernameSlug]/evals/`.
- **Routes** (Edge): `pages/api/trade-with-amm.ts`, `trade-with-limit.ts`, `deposit-mana.ts`, `save-evals.ts`.
- **Tables** only these features use: `project_evals`, `profile_trust`; the projects columns `amm_shares`,
  `founder_shares`, `auction_close` (also the grant's decision date); causes' `cert_params`.

## Rules

Observed (code, 2026-10-08). Ids are stable once merged.

### Still live for every project

- **X1** Creating a project (grant or certificate) gives its creator all its shares: a `mint cert` txn of
  10,000,000 shares of the project, from no one. Nothing shows a grant's shares.

### Certificate pages

- **X2** The page of an `active` or `complete` certificate shows: the trade box ("Sign in to trade" when signed
  out; Buy and Sell with the market maker when the project has one, otherwise "Make a trade offer"), an Offers tab
  with its buy and sell offers, and a Shareholders tab. The valuation chart shows when it has a market maker. A
  certificate proposal shows the buy box instead (B18).

### The market maker

- **X3** The market maker prices trades with a constant product: its dollars × its shares stay the same through a
  trade. Its valuation is its dollars ÷ its shares × 10,000,000; buying raises it, selling lowers it. The lowest
  valuation a limit order can name is dollars × shares ÷ 10,000,000.

### Trading

- **X4** A trade is refused, with a message, when: there's no amount; a purchase is more than the person can spend
  ("Insufficient funds"); a sale is more shares than they can sell ("Insufficient shares"). A limit order also needs a valuation, and with a market
  maker a buy order can't be above the current valuation, a sell order can't be below it, and neither below the
  lowest valuation (X3). What the person can spend is their cash balance on their own project, their charity
  balance elsewhere.
- **X5** `/api/trade-with-amm` needs a signed-in person (otherwise 401) and a finite amount above 0 (and a valuation,
  if any, above 0; otherwise 400 "Invalid amount"); a trade refused by X4 answers 400 with the message. With a
  valuation, it saves a pending `buy` or `sell` offer. Without, it trades with the market maker (`user to amm trade`),
  first filling a pending offer on the other side priced better than where the trade would take the market maker
  (`user to user trade`), and the person follows the project.
- **X6** Accepting an offer (`/api/trade-with-limit`, from the Offers tab) needs a signed-in person, a pending offer
  by someone else with a valuation above 0, and an amount above 0 and no more than the offer; the buyer must have the
  money and the seller the shares. Then shares and dollars move in one bundle (`user to user trade`) at the offer's
  valuation, and the person follows the project.
- **X7** A new buy or sell offer on an active certificate is matched at once against the other side's pending
  offers by other people, best price first, while their price is at least as good as the new offer's; each match is a
  trade at the older offer's valuation (the webhook, `pages/api/handle-new-bid.ts`).
- **X8** After a trade, the offer's amount goes down by what was traded; an offer taken in full becomes `accepted`,
  otherwise it stays `pending`.
- **X9** The Shareholders tab lists people by the shares they hold (from the project's share txns), most first,
  without the market maker.

### Grant evaluations

- **X11** `/evals-form` (signed in) lists grants to sort into tiers, with a confidence for each and trust in other
  evaluators; saving replaces the person's evaluations and trust list. `/<username>/evals` shows that person's
  evaluations with scores combined with others' evaluations of the same projects. Evaluations are public.
- **X12** Anyone can read evaluations and trust rows; only their author can add, change or delete them.

## Decisions

From the code's history; the "why" comes from PRs and commits. Newest first.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-09-11 | Team (#243) | Trade routes refuse non-finite or non-positive amounts and valuations; accepting needs a pending offer by someone else (X5, X6); evals and trust rows writable only by their author (X12) | Input checks on the trade routes |
| 2024-09-13 | Team | Mana removed from the deposit dialog (the route stayed) | Commit "Remove mana, add wire info to deposit" |
| 2024-06-11 | Team | 1,000 mana per dollar (was 100) | Commit "Update mana conversion ratio to 1000" |
| 2024-04-05 | Team (#132) | Auctions resolved by the close-grants cron at midnight Pacific on the close date, and on activation | "Prep auction close code, which hadn't been used in a year, for ACXG impact certs closing" |
| 2023-11-21 | Team (#69) | Mana deposits through the person's Manifold API key | Let Manifold users fund projects with mana |
| 2023-11-14 | Team (#66) | A market maker per certificate for the Manifold Community Fund (X3) | Trade at any time, not only against other people's offers |
| 2023-10-03 | Team (#65) | Grant evaluations as an experiment (X11) | "MVP of grant eval system", benchmarked against LTFF with dummy projects |
| 2023-02-15 | Team | Impact certificates: projects that sell shares | Retroactive funding for prize rounds |

## Open questions

Found while writing this doc (2026-10-08); none decided.

1. **Close trading on certificates?** Some pending buy and sell offers stay open on active and complete
   certificates, and the buy offers hold their bidders' charity balance (L9). Options: decline them and hide the
   trade box (X2), or keep trading open for the few who still use it (last trade 2025-05-20).
2. **Delete the mana deposit code?** `pages/api/deposit-mana.ts` and the unused `ManaTab` in
   `components/deposit-buttons.tsx`: no page has offered mana deposits since 2024-09-13.
3. **Stop minting shares for grants?** X1 runs for every new project (2,017 grants so far), and nothing reads a
   grant's shares. Dropping it touches `create-project` and the admin "give creator shares" tool.
4. **Offers left with a few cents** (X8): an offer becomes `accepted` only when the traded amount equals it exactly
   (`utils/trade.ts:50-51`, "May have issues with floating point arithmetic errors"), so rounding can leave an offer
   pending with a few cents.
5. **Evaluation scores ignore trust**: the loop meant to weigh others' evaluations by trust never runs
   (`app/[usernameSlug]/evals/page.tsx:91-92`, it starts with `epsilon = 0` and loops while `epsilon !== 0`), so
   the score combines plain averages. Delete grant evaluations (pages, route, both tables), or keep them as a record?
6. **Keep `/about/impact-certificates`?** It's still linked from the About page and certificate pages; its
   auction playground explains a mechanism no program uses.

## Later

- If certificates come back (the causes doc mentions program settings for them), start from the rules above.

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/dormant.test.ts`): X3 (pricing), X4 (trade checks), X8 (offer after a trade).
- **Component** (`tests/ai-reference/components/dormant-shareholders.test.tsx`): X9 (the Shareholders tab).
- **Database** (`tests/ai-reference/db/dormant.test.ts`): X12.
