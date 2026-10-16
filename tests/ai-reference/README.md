# AI reference tests

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked.

Tests for the agent-written docs in `docs/ai-reference/` (see its README). Each test names the rule ids it checks
(e.g. `L12`). They're separate from the main suites in `tests/`: `bun run test`, `test:routes` and `test:rules` don't
run or count them, and they have their own helpers (`helpers/`, copied from and extending `tests/helpers/`).

| Command | What | Needs |
|---|---|---|
| `bun run test:ai-reference` | `unit/`, `db/` and `components/` | local Supabase |
| `bun run test:ai-reference:rules` | which rules in `docs/ai-reference/` have tests | nothing |

- **Unit** (`unit/`) and **components** (`components/`, rendered to HTML with `react-dom/server`): no services.
- **Database** (`db/`): like `tests/db/`, every test runs in a rolled-back transaction, except a few that make
  their own throwaway accounts (`person('name')` in `helpers/people.ts`) and delete them at the end.

Settings come from the environment or the checkout's `.env.development.local`, as in `tests/README.md`.
