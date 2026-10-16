# Admin tools

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

What Manifund's team can do that nobody else can: who counts as an admin, the `/admin` pages (approvals, people and
their balances, the ledger, projects, reported comments, tools), crediting and debiting accounts by hand, and the
shortcuts to a row in the database. Most admin powers belong to an area and are written there; this doc lists them all
(see "Admin powers, everywhere") and holds the rules for the rest. How it used to work: `history.md`.

**Status of this doc.** Written from the code on 2026-10-08 (backfill), not yet read by the team. Every rule below is
**observed (code, 2026-10-08)**: what the product does today, not a decision. "What it's for" is a draft of the
intent, for the team to confirm. Suspected bugs are under "Open questions", not rules.

## What it's for (draft, to confirm)

- **Running a fiscal sponsor by hand where it's rare.** Manifund reviews every grant before money moves, credits the
  gifts that don't come through the card form (wires, ACH, crypto, donor-advised funds), records manual payouts, and
  fixes the odd project. These happen a few times a week at most, so they're simple pages for a small team.
- **One place to see the whole site**: every account with its balance, every transaction, every public project, and
  what's waiting for the team (proposals to approve, reported comments).
- **Shortcuts to the database** for what the pages don't do: each person's and project's row is one click (or one
  URL) away in Supabase's dashboard.

## How it's built

- **Who is an admin**: `isAdmin(user)` in `db/profile.ts`, a fixed list of email addresses in the code. Changing it
  is a code change and a deploy. Locally, `NEXT_PUBLIC_LOCAL_ADMIN_EMAILS` adds test accounts (the local stack sets
  one), in development builds only. Every admin check in the app (pages, API routes, the moderation buttons on
  comments) calls `isAdmin`.
- **Admin writes go through server code with the service role** (`createAdminClient`), after an `isAdmin` check in
  the route.
- **The pages** (`app/admin/`): the layout (`layout.tsx`) draws the tabs, and each page calls `requireAdmin()`
  (`lib/require-admin.ts`) before reading anything (#274). Tabs: Pending Approval
  (`approvals/`, the agreements area), Users (`users/`), Transactions (`transactions/`), Projects (`projects/`),
  Reported comments (`comment-reports/`, the comments area), Tools (`tools/`), with counts of accounts, USD txns and
  public projects on the tabs. `/admin` itself redirects to `/admin/approvals`.
- **Routes only admins may call** (all `pages/api/`, Edge runtime): `pay-user` (credit or debit an account),
  `set-alerts-paused` (the approvals list's pause button), `restore-project` (the projects list's "Restore"),
  `list-users` (every account's email; nothing calls it), and those of other areas (table below).
- **Links to Supabase's dashboard**: `utils/supabase-admin-url.ts` builds the address of a project's or profile's row
  in production's table editor. The admin tables link each row there, and `/<username>/db` and `/projects/<slug>/db`
  (route handlers) redirect to it.
- **Unused pieces** in `app/admin/`: components no page renders (`set-close-date`, `test-emails`,
  `close-old-projects`, `fix-avatars`, `add-tags`, `give-creator-shares`, `activate-project`), and `pay-user.tsx` and
  `verify-investor.tsx`, whose components were copied into `users/user-table.tsx` (only their types are still
  imported). See Open questions.

## Admin powers, everywhere

Where each power is written down. Rules there, not repeated here.

| Power | Where | Rules |
|---|---|---|
| Approve or reject a proposal (the verdict), from the approvals list or the project page | Regrants and verdicts | `../regrants/README.md`, G12-G16 |
| The approvals list itself (`/admin/approvals`), and the countersignature an approval records | Grant agreements | `../agreements/README.md`, A22, A27, A28 |
| Record an organization's tax documents on its agreement | Grant agreements | A24 |
| Pause a proposal's reminders | This doc | M11, M12 |
| Add a program's standing offer to one of its projects | Regrants | G17 |
| Edit or remove anyone's comment, with a public note or reason | Comments | `../../product/comments/README.md`, C15-C17 |
| Review reported comments (`/admin/comment-reports`) | Comments | C20 |
| Ban an account and delete what it made ("Superban") | Accounts | `../accounts/README.md`, S16, S17 (comments: C18) |
| Mark someone an accredited investor (`/admin/users`) | People | `../people/README.md`, U25 |
| Move money from any account to another ("Create txn") | Ledger | `../ledger/README.md`, L15 |
| Credit a gift received outside the site, or record a payout, by hand | This doc (the money's meaning: `../deposits-withdrawals/README.md`, W6) | M6, M7 |
| Edit a cause's or round's description and image | Causes | `../causes/README.md`, R6 |
| Read every donor-survey response, private ones included | Donor survey | `../donor-survey/` |
| Bank withdrawals while they're switched off for others | Deposits and withdrawals | W14 |
| The admin MCP server (read-only SQL and more) | Public API and MCP | `../api/README.md`, I21-I22 (its own token, not `isAdmin`) |
| Open hidden and draft projects; edit any project's fields | This doc, until the projects doc covers them | M17, M18 |
| Restore a project that wasn't funded | This doc | M9, M10 |

## Rules

Observed (code, 2026-10-08). Ids are stable once merged.

### Who is an admin

- **M1** An admin is a signed-in person whose account email is exactly one of the addresses listed in
  `db/profile.ts` (`isAdmin`). Someone signed out, or without an email, is never an admin.
- **M2** In development builds only (`NODE_ENV=development`, the local dev server), the comma-separated addresses in
  `NEXT_PUBLIC_LOCAL_ADMIN_EMAILS` are admins too (spaces around them ignored). Production builds ignore the
  variable, whatever it says.

### The admin pages

- **M3** Every page under `/admin` is for admins only: anyone else, signed in or not, gets a 404 and none of the
  page's data, because each page checks before it reads anything (A27 says the same of the approvals list). `/admin`
  opens the approvals list.
- **M4** `/admin/users` lists every account: its email, its username (linking to the profile), the accreditation
  toggle (U25), its balance with the pay box (M5, M6), and a link to its row in Supabase. A search box filters by
  email or username; "Export users.csv" downloads email, name, username, id and balance for every account.
- **M5** The balance shown there is the account's USD txns received minus those sent, with pending offers left out
  (so it can differ from the charity balance the person sees), shown to at most two decimals. Clicking it puts its
  negative in the amount box, ready to record a payout of everything.
- **M6** Paying someone (the amount box, "Add"): a positive amount is a `deposit` txn of that amount from Manifund's
  bank account (`NEXT_PUBLIC_PROD_BANK_ID`) to the person; a negative amount is a `withdraw` txn of its absolute
  value from the person to the bank. Neither is tied to a project. Only admins: anyone else gets an error and no txn
  is written.
- **M7** With "Receipt" ticked, the person is also emailed a payment confirmation for the amount, to "your Manifund
  account".
- **M8** `/admin/transactions` lists every USD txn, newest first: from and to (usernames), amount, token and date,
  under the "Create txn" form (L15).
- **M9** `/admin/projects` lists every project except hidden ones and drafts, newest first: title (linking to the
  project), creator (linking to the profile), stage, minimum funding, and a link to its row in Supabase, with a search
  by title or creator. Projects that are "not funded" have a "Restore" button, which asks for confirmation first.
- **M10** Restoring a project (admins only; anyone else gets 401) puts it back to proposal, sets its closing date to
  30 days from today, and turns every declined offer on it back to pending.
- **M11** On the approvals list, the pause button sets or clears the project's `alerts_paused` (admins only; anyone
  else gets 403 with "Only admins can pause project alerts."). New projects start unpaused.
- **M12** A paused project gets none of the daily closing check's reminders: neither the creator's "sign your grant
  agreement" nor the team's "approve this project". Pausing changes nothing else (approval, activation, closing).
- **M13** `/admin/tools` shows, for each organization account, the money given to it outside any project since a
  date the admin picks (today by default).

### Routes and shortcuts

- **M14** `/api/list-users` returns every account's id and email to an admin, and refuses anyone else.
- **M15** `/<username>/db` redirects to that profile's row in production's Supabase dashboard (an unknown username
  gets a 404).
- **M16** `/projects/<slug>/db` does the same for a project's row.

### Admins on project pages

Until the project lifecycle doc (`../../product/projects/`) covers them.

- **M17** Admins can open hidden and draft projects; anyone else but the creator sees "Access denied".
- **M18** Admins can change any field of any project through `/api/edit-project` (a creator only the fields the
  project forms show), except the scores, which the server always manages.

## Decisions

From the code's history; the "why" comes from PRs and commit messages where they give one. Newest first.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-05 | Austin (#275) | Extra local admins from `NEXT_PUBLIC_LOCAL_ADMIN_EMAILS`, development builds only (M2) | Test accounts need admin rights locally; production must ignore it |
| 2026-09-30 | Vals (#274) | Each admin page checks the admin itself and answers 404; the pages aren't cached (M3) | Content depends on who's viewing |
| 2026-09-08 | Caroline (#242) | Every admin route checks for an admin; one-off script routes and the admin "run script" tool removed | Not given |
| 2026-09-01 | Caroline (#219) | A per-project pause for approval reminders on the approvals list (M11, M12) | Stalled proposals kept sending reminders |
| 2026-07-17 | Caroline (#181) | One admin list (`isAdmin`) for every check (M1) | A second, stale list made some admins' verdicts fail silently |
| 2026-07-08 | Austin | `/<username>/db` shortcut (M15) | Not given |
| 2026-05-29 | Austin | Restore a project from `/admin/projects` (M9, M10) | Not given (the code calls it the inverse of closing an unfunded proposal) |
| 2026-03-25 | Austin | `/admin/users` redesigned: compact table, search, pay box and accreditation inline (M4) | Not given ("fix perf") |
| 2026-02-13 | Austin | `/projects/<slug>/db` shortcut (M16) | Not given |
| 2024-03-22 | Rachel | Optional donation receipt when paying someone (M7) | Not given |
| 2023-04-13 | Rachel | Donations per organization on the admin page (M13) | Not given |
| 2023-03-06 | Austin | Payments come from Manifund's bank account (M6) | Not given |
| 2023-02-20 | Austin | An admin page that can pay people (M6) | Not given |

## Open questions

1. **Restoring a rejected proposal (M10).** A rejection (G14) sets `approved = false` and the stage to "not funded",
   which is also what an unfunded proposal reaching its deadline gets. Restore puts the stage back but leaves
   `approved` as it was, so a restored rejected project never shows on the approvals list (A28 lists only projects
   without a verdict) and can't be approved from its page (G16): it stays a proposal until it closes again
   (`pages/api/restore-project.ts:29-32`). Should restore also clear the verdict, or refuse rejected projects?
2. **The receipt's id (M7).** The email's id is a new random one, not the txn's id (`pages/api/pay-user.ts:25` makes
   it, the insert at `:26-35` doesn't use it), so a receipt can't be matched to its txn. The route also returns
   nothing about the txn (the insert has no `select`). Suspected bug.
3. **Receipts for payouts (M7).** "Receipt" can be ticked with a negative amount: the person then gets a payment
   confirmation with a negative amount "to your Manifund account". Should receipts be for deposits only?
4. **Admins see the creator's buttons, which mostly refuse them.** On someone else's project, admins get the
   creator's panel (`app/projects/[slug]/project-display.tsx:192`): editing works (M18), but posting a progress update,
   closing, hiding, reactivating and publishing are refused by their routes (creator only), and the publish page
   (`app/projects/[slug]/publish/page.tsx:16`) lets an admin in, then fails at the last step. Show the panel to the
   creator only, or let admins do these on the server?
5. **`/projects/<unknown>/db` (M16)** errors (500) instead of a 404 like the profile shortcut: the route uses the
   project without checking it was found (`app/projects/[slug]/db/route.ts:10`).
6. **Unused code** (see "How it's built"): seven admin components no page renders, two duplicated ones, and
   `/api/list-users` (M14), which nothing calls. Remove them (git history keeps them)? The offers doc asks the same of
   the "Activate" button (`../offers/README.md`).
7. **The donations tool's date (M13)** starts at today, so it shows $0 everywhere until a date is picked, and the
   date box gets its first value in a format it doesn't display (`app/admin/donations.tsx:12`). Minor.

## Later

- **Whole tables in one request.** The users, transactions and projects pages read whole tables at once (the
  ledger had about 5,700 USD txns in October 2026). The database API caps a response's rows, so a table that
  outgrows it would be cut silently, balances included (M5).

## Tests

Run locally (not in CI yet): `bun run test:ai-reference` and
`bun run test:ai-reference:routes` (`../README.md`). Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/admin.test.ts`): M1, M2 (`isAdmin` in development and production builds, in a
  child process each), M5 (the balance), M15, M16 (the dashboard addresses).
- **Components** (`tests/ai-reference/components/admin.test.tsx`): M4, M5 (the users table), M9 (the projects table
  and when "Restore" shows), M13 (donations per organization).
- **Database** (`tests/ai-reference/db/admin.test.ts`): M11 (new projects start unpaused).
- **Routes** (`tests/ai-reference/routes/admin-tools.test.ts`, with the file's own people and projects; rita's admin
  calls on those rows only): M3, M4 (the CSV), M6, M8, M10, M11, M14-M18; main's `tests/routes/admin.test.ts` also
  checks M3 page by page. Not testable locally (`test.todo`): M12, which needs the daily closing check, a cron that
  reads and closes every project.
