# Admin tools: history

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Ignore it unless asked: then use or update it ([about this folder](../README.md)).

How the admin tools got to where they are, from the git history (written 2026-10-08). The current behaviour is in
`README.md`.

- **2023-02/03**: one `/admin` page (Austin) listing users with a box to pay them, first from a "Manifold bank"
  account, then from Manifund's bank account (`NEXT_PUBLIC_PROD_BANK_ID` since 2023-04, Rachel); balances and
  withdrawals shown per user; a toggle to mark accredited investors. A donations-per-charity aggregator followed
  (2023-04, Rachel), then the "Receipt" option when paying (2024-03, Rachel).
- **2024-12 (#143) and 2025-01**: the admin area split into tabs (approvals, users, transactions, projects, tools),
  each revalidated every 5 minutes; full-screen layout.
- **2026-02 to 2026-07**: shortcuts to Supabase's table editor, first for projects (`/projects/<slug>/db`), then for
  profiles (`/<username>/db`), with links from the admin tables; a compact users table with search (2026-03); a
  "Restore" button for projects that weren't funded (2026-05). All Austin.
- **2026-07-17 (#181)**: a second, older list of admin emails (used to sign verdict emails) was removed; `isAdmin`
  became the only list.
- **2026-09-01 (#219)**: approval reminders wait for the creator's signature, and admins can pause a project's
  reminders.
- **2026-09-08 (#242)**: every admin route checks for an admin, and one-off script routes (ACX emails and close
  dates, follower and agreement backfills, txn relabelling, AMM returns) and the admin "run script" tool were
  deleted.
- **2026-09-30 (#274)**: each admin page checks the admin itself (404 otherwise), and the pages stopped being
  cached.
- **2026-10-05 (#275)**: local test accounts can be admins (`NEXT_PUBLIC_LOCAL_ADMIN_EMAILS`, development builds
  only); the reported-comments tab arrived with comments everywhere.
