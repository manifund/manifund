# Public API and MCP server

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Ignore it unless asked: then use or update it ([about this folder](../README.md)).

How people and their agents read Manifund's data without the site: three JSON endpoints (`/api/v0/...`), a public
MCP server for AI assistants (`/api/mcp`), and an admin MCP server for the team. Reference for users: `/docs` on the
site.

Backfilled 2026-10-08 from the code and its history: the rules say what the product does today ("observed"), not
what anyone decided it should do, unless a decision is cited. Neighbouring areas: what the comments endpoint returns
for each comment is `../../product/comments/` (C33); balances and what a project has raised are the ledger's rules
(`../ledger/`, L5-L12, L17); what a profile shows and hides is `../people/` (E); causes are `../causes/` (R).

## What it's for (draft, for the team to confirm)

- **Public by default, for agents too.** Grants, donations and discussion are public on the site; the API and the
  MCP server let anyone, and their agents, read the same data in bulk, with no account or key ("Manifund makes all of
  our data public, for developers and LLMs alike", `/docs`).
- **Helping donors choose.** The MCP server's tools are built around finding and judging projects: semantic search,
  recommendations for a donor's interests, quality signals (score, votes, comments, money raised) and the comment
  threads (Austin, 2026-07-03, "Improve MCP server for donor recommendations").
- **Questions the site can't answer directly**, for the team: the admin MCP server adds read-only SQL, emails and
  Stripe records, for questions like "the top 10 donors this quarter" or reconciling a spreadsheet of named donors
  against accounts (`docs/plans/mcp-server.md`, the original prompt).

## How it's built

- **REST endpoints** (`app/api/v0/{projects,comments,users}/route.ts`): `GET` only, run with the caller's Supabase
  session (anonymous for most callers), so the database's read policies apply; each filters and reshapes rows in code
  (Markdown from the editor's JSON, ISO dates, only USD txns).
- **MCP servers** (`app/api/mcp/`): built with Vercel's `mcp-handler` (Streamable HTTP, stateless), inside the Next.js
  app. `route.ts` serves `/api/mcp`; `[transport]/route.ts` serves `/api/mcp/mcp` (and `/api/mcp/sse`, see Open
  questions). Every tool is
  in `register-tools.ts`: `registerPublicTools(server, { admin })` and `registerAdminTools(server)`.
- **The `admin` flag** decides what the public tier leaves out (hidden and draft projects, profile ids), in the tool
  code: a new public tool applies it too.
- **Admin tier** (`app/api/mcp-admin/[token]/[transport]/route.ts`): checked against the `MCP_ADMIN_TOKEN` setting.
- **Read-only SQL** (admin `query_sql`): the `execute_readonly_sql` database function switches to the `mcp_readonly`
  role (select on the public schema only), with a timeout and a row cap; only the service role may call it
  (migration `20260703000000_add_mcp_support.sql`).
- **Semantic search**: OpenAI `text-embedding-3-large` vectors in `project_embeddings` (kept in sync by a daily cron,
  `app/api/embeddings`), searched by `search_projects_by_embedding` (a query's vector) and `find_similar_projects`
  (a project's vector). The key is `OPENROUTER_API_KEY` or `OPENAI_API_KEY`; without one, search falls back to words.
- **Shared code**: balances use `utils/math.ts` (same as profile pages); score and votes use `utils/sort.ts`
  (`pointScore`, `countVotes`). Since Karma (#286, 2026-10-09) the site ranks by karma instead (`utils/karma.ts`),
  so the MCP's `score` (and the weekly digest's) no longer matches the homepage order (open questions).

## Rules

Ids are stable once merged: tests name them, and a removed rule keeps its id in `history.md`. All observed (code,
2026-10-08) unless a decision is cited.

### Access

- **I1** The REST endpoints (`/api/v0/projects`, `/api/v0/comments`, `/api/v0/users`) and the public MCP server
  (`/api/mcp`) are open to anyone: no sign-in, no key. They only read.
- **I2** `/docs` documents each REST endpoint (parameters, response shape, an example) and the public MCP server
  (its URL, its tools, how to connect from Claude).

### REST endpoints

- **I3** Each endpoint returns at most 100 rows, newest first; `?before=<ISO time>` returns the next page (rows
  strictly older). Dates come as ISO strings.
- **I4** `/api/v0/projects` leaves out hidden and draft projects. Each project comes with its description in
  Markdown, its creator's username and name, its causes, its USD txns and its pending offers.
- **I5** `/api/v0/comments` returns comments with the author's username and name, the content in Markdown, and the
  fields of C33.
- **I6** `/api/v0/users` returns public profile fields only: id, created date, username, name, bio, website, avatar,
  type, regrantor status. No email, accreditation status or payout account ids (Austin, 2026-08-07).
- **I7** Each user comes with the cash, charity and total balances a profile shows (L5-L12; cash and charity leave
  out pending offers, so they can add up to less than the total), and all their USD txns, newest first.
- **I8** `?id=`, `?username=` and `?name=` keep users whose id, username or name contains the text, in any case;
  together (and with `before`) every filter must match. `%` and `_` match themselves.

### Public MCP server

- **I9** The public MCP server answers at `/api/mcp` (also `/api/mcp/mcp`), over Streamable HTTP, with instructions
  for the client about Manifund, and nine tools, all reads: `search_projects`, `recommend_projects`, `get_project`,
  `get_comments`, `search_users`, `get_user`, `get_user_balances`, `get_txns`, `list_causes`.
- **I10** Its project tools leave out hidden and draft projects: searches and recommendations skip them,
  `get_project` and `get_comments` answer "No project found", and `get_user` lists only the person's other projects.
  Searches and recommendations also skip "dummy" projects.
- **I11** `search_projects` searches by meaning when given a query (and the server has an embedding key); without a
  key, or when the embedding call fails, it matches the query's words (longer than 2 letters) in titles and blurbs,
  newest first, and says so (`search_mode`, and a warning to tell the user search is degraded). Without a query it
  lists the newest projects. By default proposals and active projects; one other stage on request (`complete`,
  `not funded`); optionally one cause; 1 to 50 results (10 by default).
- **I12** Every project in a result carries its manifund.org link, what it has raised (L17: pending offers for a
  proposal), the site's score, its votes, its number of comments, its creator, causes and close date.
- **I13** `get_project` (by slug) adds the description in Markdown, the donations (the project's USD txns other than
  share trades) with the donors' names, the 5 newest comments in Markdown, and 5 similar projects.
- **I14** `get_comments` returns a project's comments newest first, replies included (with `replying_to`), in
  Markdown; 1 to 100 (20 by default).
- **I15** `recommend_projects` ranks proposals and active projects for a donor's interests: 0.65 × closeness of
  meaning + 0.25 × the score (from 0 to 50, scaled to 0-1) + 0.1 for a proposal closing within 14 days + 0.05 when
  the given budget would reach a proposal's minimum − 0.1 for a project that closed over 90 days ago. Each result
  says the gap to the minimum and the days until close. Optional causes (any of them); 1 to 30 results (10 by
  default). Without an embedding key it returns an error telling the agent to use `search_projects` instead.
- **I16** `search_users` finds profiles whose username or name contains the query, in any case (1 to 50, 10 by
  default). `get_user` (exact username) returns the profile with its total balance (L5), its projects, and its 100
  latest USD txns other than share trades, with names. The profile id is left out.
- **I17** `get_txns` lists txns newest first, filtered by user (sent or received), project, type, token (USD by
  default) and dates (both ends included, to the millisecond); 1 to 500 (100 by default). Share-trade txns (user
  to user trade, user to amm trade, inject amm liquidity, mint cert) are left out unless asked for or a type is
  given. Every other type shows, deposits and withdrawals included (Austin, 2026-07-03). An unknown user or project
  is an error.
- **I18** `get_user_balances` returns the total balance (L5) of up to 50 usernames, and lists those not found.
- **I19** `list_causes` returns every cause (slug, title, subtitle, open, program or not: R1) in the `sort` order.
- **I20** A tool that can't answer (not found, input out of range, a failure) returns an error result with a
  message, not a server error.

### Admin MCP server

- **I21** The admin MCP server answers at `/api/mcp-admin/<token>/mcp` only when the token equals the
  server's `MCP_ADMIN_TOKEN` (compared in constant time). Any other token, or no `MCP_ADMIN_TOKEN` setting at all, is
  a 401.
- **I22** It has the public tools with hidden and draft projects included (`get_project`, `get_comments`, `get_user`'s
  projects) and the profile id in `get_user`, plus four admin tools: `query_sql`, `get_database_schema` (tables,
  columns and notes on what they mean), `lookup_users` (by email, username or name, with emails) and
  `get_stripe_txns` (card deposits with the depositor's email).
- **I23** `query_sql` runs one statement (a trailing `;` is fine; two statements are refused) as a role that can
  only read the public schema, for at most 15 seconds and 1,000 rows (200 by default).
- **I24** Only server code with the service role can run that read-only SQL: visitors and signed-in people can't call
  it through the database API.

### Search in the database

- **I25** Searching by meaning (`search_projects_by_embedding`) leaves out hidden and draft projects unless asked to
  include them, and returns at most 50 projects, closest first.
- **I26** Similar projects (`find_similar_projects`) are the closest by meaning among embeddings of the same model,
  other than the project itself.

## Decisions

Newest first. Found in commits and PRs; none of these were re-confirmed during the backfill.

| Date       | Decided by         | Decision                                                                                                                                                                  | Why                                                                                           |
| ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 2026-10-05 | Austin (#275)      | Comments carry their target (`project`, `profile_id`, `org_id`), edit and removal fields; removed ones have no content (C33)                                              | Comments everywhere                                                                           |
| 2026-08-07 | Austin             | `/api/v0/users`: public fields only, the balances profiles show, all USD txns; filters by id, username, name; profiles get a `created_at` (backfilled) to sort by (I6-I8) | Profiles had no creation date; signup dates lived only in `auth.users`                        |
| 2026-07-03 | Austin             | MCP: semantic search defaults to fundable stages and says when it's degraded; quality signals; `get_comments`; `recommend_projects` (I11-I15)                             | Embeddings had silently failed since April (quota); donors need recommendations               |
| 2026-07-03 | Austin             | Public MCP shows every txn type except share trades (by default), and balances (I17, I18)                                                                                 | Deposits and withdrawals are public on the site too (L2); the old balance function was broken |
| 2026-07-03 | Austin             | Hosted MCP server in the app, public and admin tiers; the admin tier with read-only SQL (I9, I21-I24)                                                                     | Ad-hoc questions without building every aggregation                                           |
| 2025-06-24 | wasabipesto (#172) | Comments API adds `replying_to` and `special_type`                                                                                                                        | Rebuild threads; tell official updates apart                                                  |
| 2025-03-03 | Austin             | `/api/v0/comments`                                                                                                                                                        |                                                                                               |
| 2025-01-06 | Austin (#145)      | `/api/v0/projects`, 100 newest, `before` to page ("very experimental") (I3, I4)                                                                                           |                                                                                               |

## Open questions

- **Removed comments in the MCP**: `get_comments` and `get_project` return them with empty content and nothing saying
  they were removed (`register-tools.ts:367-385`), and they count in `comment_count` and the score. Show "removed by a
  moderator" and the reason, as `/api/v0/comments` does (C33)?
- **Admin search and hidden projects**: on the admin tier `search_projects` asks the database for hidden and draft
  projects too (`include_hidden`), but its stage filter (proposal and active by default; `stage` can't be hidden or
  draft) drops them again (`register-tools.ts:156-159`, `:220-224`). Should admins be able to search them?
- **A `before` that isn't a date** makes the REST endpoints fail with a server error rather than a 400
  (`new Date(before).toISOString()` throws; a 500, checked locally 2026-10-08).
- **The `/sse` addresses** (`/api/mcp/sse` and the admin server's): `mcp-handler`'s SSE transport needs
  Redis (`redisUrl`), which this setup doesn't use, so they fail (seen in-process, 2026-10-08; production's settings
  not checked). Remove them from the routes, or is SSE wanted?
- **Profile ids**: `get_user` hides the profile id on the public tier, while `/api/v0/users` and every txn
  (`from_id`, `to_id`) show ids. Is hiding it still wanted?
- **`docs/plans/mcp-server.md` is out of date** on the public tier (it says txns are limited to donations and tips,
  and `get_user_balances` is admin-only; both changed the same day, I17, I18). Update or retire it?
- **Score vs karma** (since Karma, #286, 2026-10-09): `recommend_projects` and the project summaries still rank by
  `pointScore` (net votes, comments, money), while the site sorts by karma. Switch them to karma, or keep both and say
  which is which?

## Later

- **Per-user sign-in for the MCP server** (Supabase's OAuth server), so a person's agent can comment, donate or offer
  on their behalf: public / per-user / admin tiers (`docs/plans/mcp-server.md`, "Future").
- **Typed RPC calls**: `register-tools.ts` calls `search_projects_by_embedding` and `execute_readonly_sql` untyped
  until the types are regenerated.

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components) and `bun run test:ai-reference:routes` (routes,
against a dev server); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/api.test.ts`, the MCP servers called in-process, no database): I9 (tools,
  instructions, both URLs), I11 and I14-I18 (input ranges), I20 (errors as results), I21 (the token check), I22 (admin
  tools), I23 (one statement).
- **Components** (`tests/ai-reference/components/api-docs.test.tsx`): I2 (`/docs` lists every endpoint and public
  tool).
- **Database** (`tests/ai-reference/db/api.test.ts`): I23, I24 (read-only SQL: role, limits, who may call it), I25 and
  I26 (the search functions), I8 (the id filter's text column).
- **Routes** (`tests/ai-reference/routes/api.test.ts`, against the dev server; the admin server in-process on the
  local database, since no admin token is configured locally): I1, I3-I8, I10-I14, I16-I19, I21, I22. Not covered:
  I15 (its answer depends on the server's embedding key), `query_sql` end to end (the local database lacks the role
  membership production has; the function itself is in the database tests).
