# AI reference docs

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked.

Descriptions of product areas that have no product doc yet in `../product/`. Agents read the code, the git history
and the pages on 2026-10-08 and 2026-10-09 and wrote down how each area behaved, in the same shape as the product
docs (numbered rules, decisions, open questions), with tests in `tests/ai-reference/`. The team hasn't reviewed it.

## Status

- **Not the source of truth.** `../product/` says what we want; this folder only says what the code did when it was
  written, bugs included. Where they disagree, `../product/` and the code win.
- **Optional.** Nothing in the usual workflow reads or runs it. Agents use it, or its tests, when asked or when it
  helps understand an area, and update it when asked.
- **May be stale.** The code has changed since October 2026. Rules marked "observed (code)" were read from the code
  and never confirmed by the team.

## Areas

| Folder | What |
|---|---|
| `accounts/` | Sign-up, sign-in, account settings, banning |
| `admin/` | What admins can do, across areas |
| `agreements/` | Grant agreements: what recipients sign before money moves |
| `api/` | The public API (`/api/v0`) and the MCP server |
| `causes/` | Causes and programs: pages, project tags, program terms |
| `deposits-withdrawals/` | Adding money (card, bank) and withdrawing it (Stripe Connect, Mercury) |
| `donor-survey/` | The donor survey and its results |
| `dormant/` | Older features still in the code (certificates, trading, evals, mana): what's still reachable |
| `karma/` | Karma: how projects and people are scored and sorted |
| `ledger/` | Transactions, balances, and how money moves between accounts |
| `offers/` | Offers on proposals, and how they turn into donations |
| `people/` | Profiles and the people pages |
| `regrants/` | Regrantors and the grants they give |

Each folder has a `README.md` (rules, decisions, open questions) and sometimes a `history.md`.

## Tests

`tests/ai-reference/` holds tests that name these docs' rule ids. They are separate from the main suites: `bun run
test`, `test:routes` and `test:rules` don't run or count them.

| Command | What | Needs |
|---|---|---|
| `bun run test:ai-reference` | unit, database and component tests | local Supabase |
| `bun run test:ai-reference:routes` | the app's routes as test people | local Supabase + a dev server (`tests/ai-reference/README.md`) |
| `bun run test:ai-reference:rules` | which rules here have tests | nothing |

## Promoting an area

When someone works on one of these areas, give it a real product doc:

1. Move what's still true (and wanted) into `docs/product/<area>/README.md`, in the format of `../README.md`
   ("Writing product docs"); drop what isn't. Keep the rule ids or renumber them, and check they don't clash with
   another area's letter. The letters here avoid the ones `docs/product/` uses (C, F, N, O, P, U): people's rules
   here are E, since the product doc for people has U.
2. Move the tests that still apply into the main folders (`tests/unit/`, `tests/db/`, `tests/routes/`), with main's
   helpers.
3. Delete the area's folder here, and its tests in `tests/ai-reference/`.

To drop all of it: delete `docs/ai-reference/` and `tests/ai-reference/`, and the `test:ai-reference*` scripts in
`package.json`.
