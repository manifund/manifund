# Codebase cleanup plan (July 2026)

Findings from a four-way audit (dead code, legacy `pages/api` routes, `app/`
structure, deps/config), ordered by payoff-to-risk ratio. Check items off as
they land.

## Tier 1: Zero-risk deletions (~1,200 lines + cruft)

- [ ] **Empty directories:** `app/speed/`, `app/feed/`, `app/admin/components/`,
      `app/api/deposit-manaz/` (typo'd stub), `app/api/list-txns/`, `drizzle/`
      (only an empty `meta/`, zero references anywhere).
- [ ] **Dead one-off API scripts in `pages/api/` (~640 lines, 12 files):**
      `hello.ts` (scaffold stub), `acx-grants-email-script.ts`,
      `acx-certs-email-script.ts`, `backfill-grant-agreements.ts`,
      `fix-unupdated-agreements.ts`, `categorize-txns.ts`, `return-amm-assets.ts`,
      `change-acx-close-dates.ts`, `close-chinatalk.ts`, `email-mcf-creator.ts`,
      `add-all-followers.ts`, `fix-txn-type-labels.ts`. All are already-ran
      backfills or past-event email blasts with no callers.
      _Caveat: these are POST endpoints an admin could still invoke via curl —
      confirm none are part of a manual runbook before deleting._
- [ ] **`pages/api/submit-role.ts`:** hard-returns "Funds paused" at line 113,
      making its remaining ~100 lines dead. Delete the dead body or the route.
- [ ] **Homepage A/B experiment (~207 lines):** `app/maxi/`, `app/mini/`,
      `app/minimaxi/` — nothing links to them.
- [ ] **Unused components/utils (~70 lines):** `components/data-box.tsx`,
      `components/subtitle.tsx`, `utils/perf.ts`, `utils/debug.ts` — zero
      importers each.
- [ ] **Confirm-then-delete:**
  - `AISEvaluations/` — orphaned standalone Python project.
  - Root `seed.sql` (19 KB) — `supabase/config.toml` points at
    `supabase/seed.sql`, which doesn't exist, so this is never loaded.
  - `app/causes/[causeSlug]/qf.tsx` + wiring — hardcoded to the EA Community
    Choice window (Aug–Sep 2024), ~2 years past.

## Tier 2: package.json and config

- [x] **Remove 5 unused packages** (grep-verified zero imports): `csv-parse`,
      `csv-stringify`, `rc-slider`, `@tailwindcss/line-clamp` (built into
      Tailwind since 3.3, not even in the plugins array), `@types/mailgun-js`
      (mailgun isn't a dependency).
- [x] **Move to devDependencies:** `eslint`, `eslint-config-next`,
      `typescript`, and all `@types/*` currently in `dependencies`.
- [x] **`tsconfig.json`:** bump `"target": "es5"` → `es2017` (stale for
      Next 16 + React 19).
- [x] Commit `docs/` (was untracked).

Flagged for later, no action yet:

- `reactStrictMode: false` in next.config.js — worth re-enabling eventually.
- `react-beautiful-dnd` is unmaintained with known React 19 issues — migrate
  to `@dnd-kit`.
- `snaplet` seeding looks superseded by `setup/sync-data-from-prod.ts` — if
  so, drop the `snaplet` devDep and `.snaplet/`.
- `react-uuid` (20 uses) is replaceable with built-in `crypto.randomUUID()`.
- `next.config.js` `images.remotePatterns` only whitelists the prod Supabase
  host, so dev-env images aren't optimized.
- ESLint is broken repo-wide: eslint 8's legacy `.eslintrc.json` can't load
  eslint-config-next 16's flat config (`bunx eslint <file>` crashes on any
  file). Migrate to flat config + eslint 9, or pin eslint-config-next.
  Until fixed, `no-floating-promises` / `require-await` aren't enforced.

## Tier 3: High-value refactors

1. [x] **Consolidate the duplicate admin client factory.** Canonical
       `createAdminClient()` now lives in `db/supabase-admin.ts`;
       `createAdminSupabaseClient` is gone and `db/edge.ts` re-exports the
       canonical one for existing Pages Router imports.
       _Decision: the three cookie adapters (`edge.ts`, `supabase-server.ts`,
       `proxy.ts`) were NOT unified — they read cookies from genuinely
       different sources, and the proxy version is the documented Supabase
       middleware pattern; abstracting it risks breaking session refresh._
2. [x] **Extract auth + Stripe helpers.** `getUserAndClient(req)` in
       `db/edge.ts` replaces the copy-pasted client-create/user-fetch
       boilerplate in all 26 live legacy routes. It returns `{ supabase, user }`
       and each handler keeps its own null-check and error response, so HTTP
       behavior is unchanged (normalizing the inconsistent 401/500 shapes is
       deferred to the App Router migration). Single `stripe` client in
       `utils/stripe.ts` replaces 5 identical inits (4 API routes +
       `app/withdraw/page.tsx`).
       _Decision: skipped `createBankTxn()` — the 5 bank-txn inserts differ in
       direction, txn type, `project` field, explicit id, and error handling;
       they are not true duplicates and a shared helper would be forced._
3. [ ] **Move hardcoded event data into the database.**
       `utils/constants.ts:50-127` has four `getSponsoredAmount2023/2024/2025/2026`
       functions — hardcoded regrantor-budget maps requiring a code deploy per
       cohort — and `getRoundTheme` maps past round titles to colors with
       `default: 'pink' // this should never happen`. Both belong on DB rows.
4. [ ] **Extract the "current-user charity balance" orchestration**
       (`getProfileById` → `getTxnAndProjectsByUser` → `calculateCharityBalance`)
       repeated in 7+ files (`create-grant/page.tsx`, `causes/[causeSlug]/page.tsx`,
       `funds/[fundSlug]/page.tsx`, `charity/[charitySlug]/page.tsx`,
       `[usernameSlug]/profile-content.tsx`, `sidebar.tsx`, `bottom-nav-bar.tsx`)
       into one helper in `db/`.
5. [ ] **Split oversized files:**
   - `app/api/mcp/register-tools.ts` (869 lines) → one file per tool with
     shared helpers.
   - `app/about/regranting-data/ledger.tsx` (686 lines; also duplicates
     formatters from `utils/formatting.ts`).
   - `app/projects/[slug]/creator-action-panel.tsx` (481 lines of independent
     modals with verbatim-repeated modal scaffolding).
6. [ ] **One-liner:** `app/docs/page.tsx` is `'use client'` with zero hooks or
       handlers — drop the directive (stops shipping 288 lines of static docs to
       the client bundle).

## Tier 4: Larger consistency projects (opportunistic)

- [ ] **Migrate the ~25 live legacy `pages/api/` routes to App Router.** The
      two trees are disjoint (no duplication); 43/49 legacy files repeat the same
      `export const config = { runtime: 'edge', regions: ['sfo1'] }` block.
      Sequence Tier 3 item 2 (`requireUser` extraction) as part of this.
      Removes an entire legacy paradigm — big win for LLM-assisted coding.
      Keep-as-is during migration: Stripe webhook (`stripe-endpoints.ts`, needs
      raw body), Supabase trigger webhooks (`handle-new-bid`,
      `comment-notifications`, `transfer-project`), crons (`close-grants`,
      `request-updates`, `weekly-digest`).
- [ ] **Standardize on the `<Modal>` wrapper** — 14 files import headlessui
      `Dialog` directly (each re-rolling ~40 lines of transition scaffolding) vs.
      8 using the wrapper; `creator-action-panel.tsx` imports both.
- [ ] **Merge the two utils roots:** `app/utils/` (3 files: `embeddings.ts`,
      `project-scores.ts`, `trigger-scoring.ts`) into `utils/`.
- [ ] **Three near-identical "donatable entity" pages**
      (`funds/[fundSlug]`, `charity/[charitySlug]`, `causes/[causeSlug]`) could
      share a common server component.

## Non-issues (checked, fine as-is)

- Balance/share math is centralized in `utils/math.ts` — no scattered copies.
- Project lists all render through `components/projects-display.tsx`.
- `db/` query-helper layer is real and consistently used.
- `database.types.ts` size is normal for generated code.
- `tsconfig.tsbuildinfo` is already gitignored (not committed).
- `app/api/v0/` routes are internally consistent; minor inline-select
  duplication only.
