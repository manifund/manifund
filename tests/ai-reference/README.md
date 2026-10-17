# AI reference tests

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked.

Tests for the agent-written docs in `docs/ai-reference/` (see its README). Each test names the rule ids it checks
(e.g. `L12`). They're separate from the main suites in `tests/`: `bun run test`, `test:routes` and `test:rules` don't
run or count them, and they have their own helpers (`helpers/`, copied from and extending `tests/helpers/`).

| Command | What | Needs |
|---|---|---|
| `bun run test:ai-reference` | `unit/`, `db/` and `components/` | local Supabase |
| `bun run test:ai-reference:routes` | `routes/`: the app's routes as test people | local Supabase + a dev server |
| `bun run test:ai-reference:rules` | which rules in `docs/ai-reference/` have tests | nothing |

- **Unit** (`unit/`) and **components** (`components/`, rendered to HTML with `react-dom/server`): no services.
- **Database** (`db/`): like `tests/db/`, every test runs in a rolled-back transaction, except a few that make
  their own throwaway accounts (`person('name')` in `helpers/people.ts`) and delete them at the end.
- **Routes** (`routes/`): HTTP calls to a running server against the local stack. Each file makes its own people and
  projects and deletes them at the end; the shared test accounts `alice`, `bob` and `rita` are only read (rita does
  admin actions). `TEST_LEVEL` works as in `tests/` (`full` also recomputes karma in the local database).
  - Use a dev server (`next dev`): admins from `NEXT_PUBLIC_LOCAL_ADMIN_EMAILS` and the donor survey's save action
    only work there. Turbopack or webpack both work.
  - On port 3000 (`TEST_BASE_URL`, default `http://localhost:3002`): the local database's webhooks (new offers,
    sign-ups) call port 3000, and the offer, activation and grant-claim tests wait for them.
  - A dev server grows as it compiles pages (4-6 GB for one large file here). On a small machine, run one file at a
    time (`bun run test:ai-reference:routes tests/ai-reference/routes/offers.test.ts`, `TEST_PARALLEL=1`) and restart
    the server between files.

Settings come from the environment or the checkout's `.env.development.local`, as in `tests/README.md`.
