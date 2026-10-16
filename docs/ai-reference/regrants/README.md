# Regrants and verdicts

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

Regrantors giving grants from their budget, and admins' verdicts on proposals (approve or reject). How it used to
work and how it changed: `history.md`.

Written 2026-10-08 from the code and its history (a backfill: the product existed before this doc). Rules say what
the product does today, marked *observed (code, 2026-10-08)*; nothing here was decided by the team unless a decision
says so. Neighbouring areas: offers becoming donations when a project activates (`docs/ai-reference/offers/`), balances
and the ledger, including claiming a grant sent to an email (`docs/ai-reference/ledger/`), grant agreements and the admin
approvals list (`docs/ai-reference/agreements/`), the rationale and the admin's note as comments
(`docs/product/comments/`, C23, C26, C27).

## What it's for

Draft for the team to confirm (from `docs/product/intent.md`, the about pages and the PRs):

- **Regranting**: people close to a field (regrantors) get a budget and make grants in it, quickly and on their own
  judgment. Manifund reviews each grant and pays it once approved and the grant agreement is signed.
- **A grant for anyone**: a regrantor can fund someone already on Manifund, or someone who isn't yet (they claim
  the project when they sign up with the email it was sent to).
- **Public reasoning**: every grant comes with the regrantor's rationale, so donors can learn whose taste to trust
  (`/about/regranting-data` lists every grant a regrantor made).
- **A verdict on every proposal**: admins approve or reject each grant proposal (regrants and ordinary proposals
  alike) before money moves; an approval records the public benefit the grant serves (presumably for fiscal sponsorship records).

## How it's built

- **Regrantors** are profiles with `regranter_status`. Their budget is their charity balance, computed from the
  ledger like everyone's (deposits, and "profile donation" transfers from Manifund's account; the yearly reset uses
  "return bank funds" txns, #137).
- **Giving a grant**: `/create-grant` (form) → `POST /api/create-grant` (`app/api/create-grant/route.ts`), which
  checks the regrantor's balance, then calls one SQL function that writes the project and the regrantor's offer in
  one transaction: `give_grant_v2` for someone on Manifund, `create_transfer_grant_v2` for someone not on it (also
  writes a `project_transfers` row). Both are `security definer` with checks on the caller. After that, outside the
  transaction: the recipient's email, the rationale comment (`lib/comments`), the project's causes, the projects
  cache, scoring.
- **A grant is an offer.** The regrantor's contribution is a pending `donate` bid; it becomes a `project donation`
  txn only when the project activates (`utils/activate-project.ts`, `activate_grant`: the offers area).
- **Verdicts**: the admin's modal (`app/admin/grant-verdict.tsx`, on `/admin/approvals` and the project page) →
  `POST /api/issue-grant-verdict` → `execute_grant_verdict_v2` (service role only), then the admin's note (a comment),
  the verdict email, and an activation check.
- **A fixed-offer button**: an admin-only button on projects in one microgrants program (the `leo-microgrants`
  cause) places a $10k offer from that program's funder account (`pages/api/leo-grant-offer.ts`).
- **Community Choice roles** (`profile_roles`): roles people claimed in EA Community Choice (2024), each worth $100
  to donate. Claiming is paused.

## Rules

Ids are stable once merged: tests name them, and a removed rule keeps its id in `history.md`. All observed (code,
2026-10-08).

### Regrantors

- **G1** Regrantors see "Give a grant" (`/create-grant`) where others see "Create a project", in the sidebar and the
  bottom bar; they have a "regrantor" tag on their profile, and are listed on the Regrants round's page
  (Regrantors tab). `/about/regranting` shows only the sponsored cohorts of 2023-2025, a list kept in the code.
- **G2** The grant form is only for signed-in regrantors: a visitor gets a link to log in, a signed-in person who
  isn't a regrantor "You must be a regranter to give grants", with a link to their profile.
- **G3** A regrantor gives from their charity balance: the form shows it as the most they can give, and the server
  refuses a larger contribution ("insufficient funds", 400), leaving nothing behind.

### Giving a grant

- **G4** The recipient is either a person on Manifund (by username) or someone who isn't (a name and an email),
  never both: anything else is refused ("invalid inputs", 400), an unknown username is a 404, and a signed-out
  request a 401.
- **G5** A grant creates, all together or not at all, a new project (a grant in the "Regrants" round, a proposal, not
  yet approved, agreement unsigned, every share with the founder) and the regrantor's offer for their contribution
  (a pending donation offer). The regrantor follows the project. No money moves.
- **G6** A grant to a person on Manifund makes the project theirs from the start.
- **G7** A grant to someone not on Manifund leaves the project with the regrantor, with the recipient's name and
  email (stored in lowercase) kept beside it, until someone signs up with that email, in any case; the project then
  moves to them (the claim: ledger L18). If the email, in any case, already belongs to an account, the grant goes to
  that account at once, as G6 (the account's own name is used, not the name typed; it gets the existing-user email).
  Decided 2026-10-09 (Vals; shipped in #290).
- **G8** The database refuses a grant in someone else's name (the offer's donor, and for a grant to an email the
  project's creator, must be the signed-in person), from a visitor, or with a missing or negative amount. A $0
  contribution is accepted (a grant that only asks other donors).
- **G9** The regrantor's offer becomes money only when the project activates (`docs/ai-reference/offers/`): a
  project donation from the regrantor to the recipient. A declined offer holds nothing.
- **G10** After the grant is saved, the recipient gets one email about it (C23), and the rationale is posted (C26).
  A recipient email that fails is logged (`grant.recipient_email_failed`) and doesn't undo the grant.
- **G11** The causes chosen on the form are attached to the project. The form offers causes that are open and aren't
  prizes.

### Verdicts

- **G12** Only admins issue verdicts (403 otherwise). The admin needs a profile with a name (it signs the email):
  without one nothing changes (500). An unknown project is a 404.
- **G13** Approving records the approval and the public benefit chosen, and marks the project's grant agreement as
  approved by that admin (`docs/ai-reference/agreements/`). Offers and stage are left alone; the activation check that
  follows makes the project active right away if its offers reach the minimum and its agreement is signed.
- **G14** Rejecting marks the project not approved and "not funded", and declines every pending offer on it, so no
  balance is held for it any more. Accepted offers and donations already made stay.
- **G15** The verdict's database function runs only with the server's service role: browsers can't call it.
- **G16** On a project's page, admins get an "Approve" button for a proposal that hasn't had a verdict and whose
  offers reach its minimum (the approvals list: agreements area).

### The fixed-offer button

- **G17** On a project in the "leo-microgrants" cause, an admin can add a $10,000 offer from the program's funder
  account (named in the route): an ordinary pending donation offer. Refused for non-admins (401), for projects
  outside the cause (400), and when the account doesn't exist (404).

### Community Choice roles

- **G18** A person has at most one set of roles, which anyone can read and only that person can write.
- **G19** Claiming roles is paused: `/api/submit-role` refuses every request ("Funds paused", 400) and records
  nothing, no roles and no money.

## Decisions

Newest first. Only decisions found in the history; the rules above are otherwise observed, not decided.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-09 | Vals (#290) | A grant to the email of an existing account, in any case, goes to that account at once (G7) | Only a sign-up claims a transfer, so it stayed pending for good |
| 2026-09-30 | Vals (money review) | A failed recipient email or admin note doesn't undo the grant or verdict; it's logged and the person told (G10, C27) | The money is saved by then; the rest can be redone |
| 2026-10-09 | Vals | An email Postmark refuses counts as failed: logged (`grant.recipient_email_failed` for G10; `email.failed` from the email helpers, with the template and ids, not the address) | Refusals passed silently before: `sendTemplateEmail` didn't read Postmark's answer |
| 2026-09-28 | Vals | Grant functions stop inserting comments (`_v2`); the rationale and note go through `lib/comments` (C26, C27) | One writer for comments; money stays atomic |
| 2026-07-17 | Caroline (#181) | One admin list; the verdict email is signed from the admin's profile name; the route and modal report errors | Verdicts by some admins failed silently |
| 2026-06-23 | Austin | A fixed $10k offer button for projects in one microgrants program (G17) | Not recorded (commit 1d72329a adds the button) |
| 2024-04-12 | Rachel (#137) | Regranting 2024: last year's unspent budgets cleared with "return bank funds" txns; the form validates emails and asks about lobbying and location | New program year |
| 2023-06-16 | Rachel (#41) | Regrantors set a minimum and a goal, so a grant can ask other donors for the rest | Regrantors needn't fund a project fully |
| 2023-06-02/16 | Rachel (#37, #39) | Admins approve every grant; a project activates once approved, signed and at its minimum | Fiscal sponsorship: Manifund reviews before paying |
| 2023-04-21 | Rachel (#31) | Grants to people not yet on Manifund are claimed at sign-up | Regrantors fund people where they find them |

## Open questions

- **A verdict on a project that isn't an undecided proposal.** Neither the route nor `execute_grant_verdict_v2`
  checks the project's stage or an earlier verdict; the admin's modal only appears for undecided proposals. Should
  both refuse a verdict on an active project, or a second verdict?
- **The fixed-offer button can place two offers** on the same project (a double click). Should a second be refused?

For the team:

- **Intent** (the "What it's for" section) is a draft from the code and PRs.
- **Who makes someone a regrantor, and how budgets arrive**: the app has no screen for either (G2's link goes to the
  person's profile); presumably Manifund does both by hand. Worth writing down how.
- **The fixed-offer button** hard-codes an account name, a cause and an amount. Fine while it's one program; a general
  "fund adds a fixed offer" would replace it if more appear.
- **Community Choice roles (G18, G19)**: the round is over and claiming is paused. Keep the table and the paused
  route, or retire both (the people area documents profiles)?

## Later

- Nothing planned yet.

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/regrants.test.ts`): G9 (a grant offer from pending to activation).
- **Database** (`tests/ai-reference/db/regrants.test.ts`): G5-G9 (the grant functions: what they write, who may call
  them), G13-G15 (the verdict function), G18 (roles).
