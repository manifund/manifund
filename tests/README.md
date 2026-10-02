# Tests

Tests check the rules in the product docs (`docs/product/<area>/README.md`): each test names the rule ids it
checks (e.g. `C11`), and `bun run test:rules` lists rules that no test names yet. They run **locally**, against the
local Supabase and a dev server; they're not set up for CI yet.

## Running them

| Command | What | Needs | Time |
|---|---|---|---|
| `bun run test` | unit + database | local Supabase running | ~1 s |
| `bun run test:unit` | pure logic only | nothing | <1 s |
| `bun run test:db` | the database's own rules (triggers, row-level security) | local Supabase | <1 s |
| `bun run test:routes` | the app's API and pages, as test people | local Supabase + the dev server | ~1-2 min |
| `bun run test:e2e` | a few flows in a real browser (Playwright, Chromium) | local Supabase + the dev server | ~1 min |
| `bun run test:all` | all of the above | both | ~3 min |
| `bun run test:rules` | which rules have tests | nothing | <1 s |

How much to run, for route tests: `TEST_LEVEL=smoke` (the core of each area), default `standard`, or `full` (also
the slow ones: grants and verdicts, the daily warning). One file or test: `bun test --conditions react-server
tests/unit/content.test.ts`, or add `-t "C11"`. Browser tests: `bun run test:e2e -- --headed` to watch them,
`-g "C12"` for one.

Settings come from the environment or the checkout's `.env.development.local` (written by the local stack):
`TEST_BASE_URL` (default `http://localhost:3002`), `TEST_DB_URL` (local only; tests refuse a remote database),
`TEST_PASSWORD`, `TEST_LEVEL`. First time for browser tests: `bunx playwright install chromium`.

## How they're built

- **Runner:** `bun test` (built into Bun; Jest-style API) for unit, database and route tests; Playwright for
  browser tests. `--conditions react-server` lets tests import server modules (`server-only`).
- **Unit** (`tests/unit/`): pure functions, no services.
- **Database** (`tests/db/`): Bun's Postgres client as the database superuser; every test runs in a transaction
  that is always rolled back (`inRollback`), and can act as a signed-in user (`actAs`) or a visitor
  (`actAsAnon`) so row-level security applies. Production-only rules (e.g. no direct writes from browsers) are
  applied inside the transaction.
- **Routes** (`tests/routes/`): HTTP calls to the dev server as the local test accounts `alice`, `bob` and
  `rita` (an admin in development), signed in through local Supabase Auth. Each run creates its own project,
  program and topic, and deletes them and every comment it made at the end (rows carry a run marker). Throwaway
  accounts cover rate limits. So the rate limits don't refuse the suite's own setup, each test starts with the
  run's earlier comments moved a day into the past.
- **Browser** (`tests/e2e/`, files `*.e2e.ts`): Playwright on Node, with setup through Supabase's REST API and the
  app's API; `teardown.ts` deletes what they made.

## Writing a test

- Name the rule: `describe('C11 one level of replies', …)`. A decided rule that isn't built yet gets
  `test.todo('…')`, so it shows up.
- Pick the cheapest layer that proves the rule: logic in unit tests, what the database guarantees in database
  tests, who may do what in route tests, what people see in browser tests.
- Use `smoke` / `standard` / `slow` from `tests/helpers/levels.ts` instead of `test` in route tests.
- Only the test accounts and the run's own fixtures: never real people or projects, even locally.
