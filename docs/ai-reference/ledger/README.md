# Balances and the ledger

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

Where Manifund's money is recorded, and how each person's balances are worked out from it.

**Status of this doc (2026-10-08).** Written from the code and its history by an agent, not yet reviewed. Rules
describe what the product does today ("observed (code, 2026-10-08)"); where a rule says why, that's the agent's
reading of commits and code comments, a draft for the team to confirm. Nothing here was decided for this doc.

Related areas: offers and activation (`docs/ai-reference/offers/`, rule letter B: offers on proposals, how they
become donations), regrants (`docs/ai-reference/regrants/`, G), deposits and withdrawals
(`docs/ai-reference/deposits-withdrawals/`, W), the comment tips (`docs/product/comments/`, C35), dormant trading
and certificates (`docs/ai-reference/dormant/`, X).

## What it's for

- **One record of every dollar.** Deposits, donations, grants, tips, withdrawals: each is a row in one ledger, so
  anyone can trace where money came from and went.
- **Public money.** Donations and grants are public (see "Public by default" in `docs/README.md`): the ledger is
  readable by anyone, profiles show balances, and `/finances` lists everyone's balance and Manifund's own balance
  sheet.
- **Two kinds of money per person.** Money given to charity through Manifund can only be given on ("charity
  balance"); money a project received can be withdrawn ("cash balance"). The ledger keeps them apart without
  separate accounts, by the type of each movement.

## How it's built

- **`txns`, one row per movement of money**: `from_id`, `to_id` (profiles), `amount`, `token` (`USD` for money; a
  project's id for that project's shares, from the dormant certificates), `type`, `project` when it's about one,
  `bundle` to pair the two legs of a trade. Types: deposit, withdraw, project donation, profile donation, tip,
  cash to charity transfer, return bank funds, mana deposit, and the dormant ones (mint cert, user to user trade,
  user to amm trade, inject amm liquidity).
- **Balances are computed, never stored**: `utils/math.ts` sums a person's txns (and their pending offers, from
  `bids`) each time a page or route needs them. Reads: `db/txn.ts`.
- **Manifund's bank account** (`Manifund-Bank`, its id in `NEXT_PUBLIC_PROD_BANK_ID`) is the other side of money
  entering or leaving: deposits come from it and withdrawals go to it, so its own balance is very negative.
- **Writers** (all server code with the service role): donations (`pages/api/transfer-money.ts`, this area),
  activation of a project (B), grants (G), deposits, withdrawals and moving cash to charity (W), tips
  (`tip_comment`, C35), an admin paying a user (`pages/api/pay-user.ts`), the welcome money for declaring roles
  (`pages/api/submit-role.ts`), and one-off scripts (`scripts/return-declined-grant.ts`).
- **Project transfers**: a regrantor can give a grant to someone without an account, by email (G). The project is
  created under the regrantor with a `project_transfers` row; when that person signs up, a database webhook calls
  `pages/api/transfer-project.ts`, which hands the project over (`_transfer_project`).
- **`/finances`** (`app/finances/`): a server page that reads every USD txn with the service role and shows each
  account's total balance, under a balance sheet typed in by hand.

## Rules

### The ledger

- **L1** Every movement of money is one row in `txns`, and a person's balances are computed from those rows and
  their pending offers each time; no balance is stored. Observed (code, 2026-10-08).
- **L2** The ledger is public: anyone, signed in or not, can read every txn. That's how profiles, project pages,
  `/finances` and the public API show money. Observed (code, 2026-10-08).
- **L3** Only server code writes the ledger: browsers, signed in or not, can't add, change or delete txns.
  Observed (code, 2026-10-08).
- **L4** A profile that appears in the ledger (as sender or recipient) can't be deleted: the money history about a
  person stays. Observed (code, 2026-10-08).

### Balances

A profile shows three numbers: the **total balance**, the **charity balance** (money to give: donate, offer, grant,
tip) and the **cash balance** (money that can be withdrawn), plus "$X in pending offers" (total minus the other two).

- **L5** The total balance is the USD a person received minus the USD they sent. A txn to oneself (moving cash to
  charity) counts zero, share txns don't count, and pending offers don't reduce it (an offer is a row in `bids`, not
  a txn, until activation turns it into one: B11). Observed (code, 2026-10-08).
- **L6** Charity balance goes up with deposits, profile donations and tips received, mana deposits, cash moved to
  charity and returned bank funds; it goes down with project donations, profile donations and tips sent.
  Withdrawals don't touch it. Observed (code, 2026-10-08).
- **L7** Cash balance goes up with project donations received (donations and grants to your projects); it goes down
  with withdrawals and with cash moved to charity. Deposits, profile donations and tips don't touch it. A project
  donation exists only once money has moved: a direct donation to an active project (L13), or an offer turned into
  one at activation (B11). A proposal that has reached its minimum but isn't approved or signed yet has only pending
  offers, which add nothing to the creator's cash. Observed (code, 2026-10-08).
- **L9** Pending offers set money aside: an offer to buy or donate on someone else's project comes off the charity
  balance shown. Offers to sell and offers no longer pending set nothing aside. The amount is the sum of the
  person's pending offers (`bids` rows with status `pending`), worked out with the balances each time
  (`utils/math.ts`). Observed (code, 2026-10-08).
- **L12** A profile never shows a negative cash balance: a negative one shows as zero, and the difference comes off
  the charity balance shown (a workaround for older accounting, per the code comment). Observed (code, 2026-10-08).

### Donating

Donations to projects in proposal are offers (B); this is the direct donation to an active project or to an
account (a regrantor's budget, a fund).

- **L13** A signed-in person donates from their charity balance: to a project (the money goes to its creator, as a
  "project donation" naming the project) or to an account (a "profile donation"). Observed (code, 2026-10-08).
- **L14** A donation can't be more than the donor's charity balance (pending offers count as spent), and can't be
  negative. Observed (code, 2026-10-08). A person's donation to a grant project is also at least $10 and at most
  what's left of its funding goal, on the page and the server alike (`../offers/README.md` B21; Vals, #289). Donations to a person or a fund keep only the balance check on the server
  (the person's donate box asks for $10; the fund and cause boxes don't).
- **L15** Only the account's owner donates from it; an admin can move money from any account (admin page, "Create
  txn"), still within that account's charity balance. Observed (code, 2026-10-08).
- **L16** Donating to a project follows it; a donor who already follows it can donate again (fixed by Vals
  2026-10-09, #291: the second donation answered 500 after the money moved). Observed (code, 2026-10-08).

### Project raised amounts

- **L17** What a project has raised: once it's past proposal, the USD txns on the project to its creator (donations,
  grants, the offers paid at activation); in proposal, its pending offers (B); a "dummy" project shows its funding
  goal. Observed (code, 2026-10-08).

### Grants to people without an account

- **L18** When someone signs up, each pending project transfer addressed to their email, ignoring case, makes them
  the project's creator and is marked done; transfers already done are left alone. No money moves at that step (the
  grant's offer stays with the project). A grant to an email stores it trimmed and in lowercase, as sign-up does.
  Only a new sign-up triggers this, so a grant to the email of an existing account doesn't make a transfer: it goes
  to that account at once (regrants G7). Observed (code, 2026-10-08); case-insensitive since 2026-10-09, existing
  accounts since 2026-10-09 (Decisions).
- **L19** Until its transfer is done, the project doesn't show in the projects list of the profile it's under (the
  regrantor's). Observed (code, 2026-10-08).
- **L20** The sign-up webhook (`/api/transfer-project`) refuses calls without the webhook secret. Observed (code,
  2026-10-08).

### Finances page

- **L21** `/finances` is public: every account with its username, name and total balance (L5) rounded to the
  dollar, highest first, and never an email address. Observed (code, 2026-10-08).
- **L22** Its "total" of user balances leaves out the Manifund-Bank account. Observed (code, 2026-10-08).
- **L23** The balance sheet above it (bank and Stripe balances, liabilities, net assets) is typed in by hand, says
  when it was last updated and that values are estimates; it isn't computed from the ledger. Observed (code,
  2026-10-08).

## Decisions

From the git history; dated by commit, who made it as far as the commit shows. None of these were reviewed for this
doc.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-09 | Vals (#290) | A grant to the email of an existing account goes to that account directly, as a grant by username (L18, regrants G7) | Only a sign-up claims a transfer, so such a grant stayed pending |
| 2026-10-09 | Vals (#290) | Transfers match the sign-up email ignoring case, and new ones store the email in lowercase (L18) | Sign-up stores emails in lowercase, so a grant typed with capitals was never claimed |
| 2026-10-08 | Vals (review), direction to confirm | Hiding a project is like closing it: its creator can't reopen it, and the record keeps the offers made on it (not built) | Unhiding would reopen others' committed money in a confusing way |
| 2026-07-04 | (commit) | Drop the `get_user_balances` SQL function; balances only in `utils/math.ts` | It was broken and unused; the MCP server uses `calculateUserBalance` |
| 2024-11-16 | Austin (commit) | Donations can't be negative (L14) | "Disallow negative amounts" |
| 2024-07-15 | Austin (commit) | A public `/finances` page with everyone's balances and a balance sheet (L21-L23) | Transparency; linked from the about page |

## Open questions

- **Old SQL functions**: the database keeps several versions of `transfer_project` / `_transfer_project`; only the
  three-argument `_transfer_project` is called. Candidates for removal, with the team. (Vals 2026-10-08: later, with the dead-code sweep.)

## Later

- Remove `calculateUserLockedFunds` (`utils/math.ts`): no caller.
- Data-protection requests (GDPR erasure): L4 keeps a person's money history. When a first request comes, check what
  the law asks of a fiscal sponsor (financial records usually have to be kept) and whether anonymising the profile
  (name, bio, avatar) is enough (Vals 2026-10-08, low priority).
- The server could apply the $10 minimum to donations to a person or a fund too (L14), as it does for projects
  since 2026-10-09 (Vals 2026-10-08, "tbd").
- Parts of the balance sheet (user balances, pending transfers) could come from the ledger instead of by hand.

## Tests

Run locally: see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/ledger.test.ts`): L1, L5-L7, L9, L17, `/finances`' balances matching L5
  (L21), and finding a transfer by email, ignoring case (L18).
- **Database** (`tests/ai-reference/db/ledger.test.ts`): L2, L3, L4, L18 (the hand-over function).
