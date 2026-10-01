# Recon

Local reconciliation tool. Matches bank/Stripe transactions against platform
`deposit`/`withdraw` txns, categorizes everything else, and reports the expected
change in net assets for a window.

```bash
bun tools/recon/server.ts   # http://localhost:8787
```

Reads prod Supabase **read-only** (needs `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PROD_BANK_ID` in `.env.local`). All
tool state lives in `tools/recon/data/*.json`, which is gitignored — it contains
donor names, grantee payments, payroll, and user emails. Never commit it.

Run only one server at a time; two processes will clobber each other's state.

## Workflow

1. **Import** — drop in CSV exports. Mercury and Stripe auto-detect; anything
   else prompts for a column mapping. Rows dedupe on a per-source key.
2. **Auto-match** — pairs Stripe charges to deposits on email, then bank rows to
   platform txns on amount + date. Ambiguous cases are left for manual review.
3. **Matching** — link the rest by hand, or tag rows that have no platform
   counterpart (rent, payroll, direct grants) with a category.
4. **Overview** — expected ΔNAV for the window, broken into money in, money out,
   and an "unexplained diff" that goes to zero once everything is reconciled.
5. **Snapshot** — save month-end balances to compare against the next run.

## data/config.json

Not committed. Maps Mercury account last-4 digits to sources and defines
payee-specific categorization rules:

```json
{
  "mercuryAccounts": { "1234": "mercury_grants", "5678": "mercury_mox" },
  "payeeRules": [
    { "pattern": "GUSTO", "category": "payroll" },
    { "pattern": "^Frame\\b", "category": "revenue_fellowships", "inflowTo": "mercury_mox" }
  ]
}
```

Without it, Mercury rows import as off-sheet. A rule with `inflowTo` applies only
to inflows into that account and runs ahead of the generic rules, for payers whose
description would otherwise look like an internal transfer.

## NAV-neutral tags

Some money movements change a balance-sheet line without changing NAV. Each has
a tag so it stays out of revenue, donations, and the unexplained diff:

- `loan_repayment` (bank category) — a loan receivable turning back into cash.
- `regrantor_pot` (off-platform match category on a platform deposit) — a
  balance credited out of the regrantor pot liability.
- **Uncredited** (the "uncredited $" box on a match) — part of a bank inflow
  received for a platform account that does not exist yet; a pending liability.
  When the account is created and credited, unmatch and rematch with the new
  platform deposit.

## Gotchas

- **Mercury reissues transaction ids** when a wire goes from pending to settled,
  which defeats the dedupe key and duplicates rows. After importing, group by
  (source, date, amount, description) and look for groups mixing hash-style and
  numeric ids. Ending an import a few days before the last settled date avoids it.
- **Rows whose status isn't `Sent` are dropped**, so pending wires never appear.
- **Stripe payouts that straddle the export boundary get double-counted** — the
  Mercury inflow lands with no Stripe-side leg, and an unmatched
  `internal_transfer` is booked as a real external inflow. Extend the Stripe
  export past month end far enough to capture the payout.
- **Only manually added rows can be deleted.** Fixing an imported row means
  editing `data/bank-txns.json` with the server stopped.
