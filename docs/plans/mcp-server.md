# Manifund MCP Server

## Original prompt

> I'd like to create a hosted MCP server for Manifund, so eg from Claude and Claude Cowork I can make particular requests like "look up who the top 10 outgoing donors have been this quarter, and a list of what projects they've given to" or "here's a screenshot of an Google Sheet, make sure the account balances match to these named donors" or "what 5 projects might a donor who cares about AI safety video projects want to look at?"
>
> - Initial key functionality: search for users, search for projects, query txns by user/project, anything else that matters?
> - First implementation can be readonly but eventually would be nice to set it up to auth as a particular user and then do write actions
> - I'm not sure how auth works for MCP, but it'd be good for others to be able to connect too
> - I'm not sure how much to structure as MCP vs make available as SQL??

## Overview

A hosted, read-only MCP server built into the Next.js app with Vercel's
[`mcp-handler`](https://github.com/vercel/mcp-handler) (Streamable HTTP
transport, no Redis needed). It deploys with the app — there is no separate
service.

Routes: `app/api/mcp/route.ts` serves the clean `/api/mcp` URL (Streamable
HTTP); the sibling `app/api/mcp/[transport]/route.ts` serves
`/api/mcp/mcp` and `/api/mcp/sse`. The public server is documented for
users at [manifund.org/docs](https://manifund.org/docs).

There are **two endpoints, two permission tiers**:

| Tier   | URL                                              | Auth                         | Data access                               |
| ------ | ------------------------------------------------ | ---------------------------- | ----------------------------------------- |
| Public | `https://manifund.org/api/mcp`                   | None                         | Only what the site already shows publicly |
| Admin  | `https://manifund.org/api/mcp-admin/<token>/mcp` | Secret token in the URL path | Everything, including read-only SQL       |

The design is hybrid MCP + SQL: structured tools cover the common paths
(search, lookups, txn queries), and the admin tier's `query_sql` tool covers
arbitrary ad-hoc analysis ("top 10 outgoing donors this quarter") without
having to pre-build every aggregation.

## Permissions model

### Public tier (`/api/mcp`)

No authentication. Anyone (or any agent) can connect. It must therefore only
expose data that is already visible on manifund.org:

- Projects excluding `hidden` and `draft` stages (and excluding `dummy` type)
- Profiles (username, full name, bio — never emails or profile ids)
- Txns restricted to the publicly-displayed types: `project donation`,
  `profile donation`, `tip`. Deposits, withdrawals, and trades are not
  queryable here.

Implementation note: both tiers use the Supabase **service-role client**
internally (`createAdminSupabaseClient`), so the public restrictions are
enforced in the tool code in `app/api/mcp/register-tools.ts` — via the
`admin: boolean` flag passed to `registerPublicTools()` — **not** by RLS.
When adding a public tool, treat that flag as the security boundary.

### Admin tier (`/api/mcp-admin/<token>/mcp`)

Gated by the `MCP_ADMIN_TOKEN` env var, compared timing-safely against the
URL path segment (same pattern as Zapier/Composio MCP URLs — a secret URL,
because claude.ai custom connectors support only "no auth" or full OAuth,
not API-key headers). If the env var is unset, the endpoint always 401s.

The admin tier registers the same public tools with `admin: true` (which
unlocks hidden/draft projects and all txn types) plus admin-only tools for
emails, balances, Stripe records, and SQL.

### `query_sql` sandboxing

The admin `query_sql` tool is the one spot where the model writes arbitrary
SQL, so it gets defense in depth (see
`supabase/migrations/20260703000000_add_mcp_support.sql`):

1. Queries run through the `execute_readonly_sql()` Postgres function, which
   is callable **only by `service_role`** (execute revoked from `public`,
   `anon`, `authenticated`). It is SECURITY INVOKER — Postgres forbids
   `SET ROLE` inside security-definer functions — with `service_role`
   granted membership in `mcp_readonly`.
2. Inside, it does `SET LOCAL ROLE mcp_readonly` — a role with SELECT-only
   grants on the `public` schema. Writes fail on permission checks, not on
   string matching, and other schemas (e.g. `auth`) are not granted at all.
3. `SET LOCAL statement_timeout = '15s'` bounds runaway queries.
4. The query is wrapped in a subselect with a row cap (default 500,
   max 1000), and the TS layer rejects multi-statement input.

## Tools

### Public (both tiers)

| Tool              | Purpose                                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_projects` | Semantic search via the existing `project_embeddings` (OpenAI `text-embedding-3-large`) when a query is given — "AI safety video projects" just works. Falls back to `ilike` text search if `OPENAI_API_KEY` is missing or embedding fails. Filterable by cause and stage. |
| `get_project`     | Full project by slug: markdown description, donations with donor names, causes, similar projects (`find_similar_projects`).                                                                                                                                                |
| `search_users`    | Profile search by username / full name.                                                                                                                                                                                                                                    |
| `get_user`        | Profile + their projects + recent donations given/received.                                                                                                                                                                                                                |
| `get_txns`        | Txns filtered by user, project, type, token, date range.                                                                                                                                                                                                                   |
| `list_causes`     | Cause slugs for filtering.                                                                                                                                                                                                                                                 |

### Admin only

| Tool                  | Purpose                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `query_sql`           | Arbitrary read-only SQL (see sandboxing above).                                                                      |
| `get_database_schema` | All tables/columns plus semantic notes (txn types, token semantics, etc.) so the model writes correct SQL first try. |
| `get_user_balances`   | Current USD balances (wraps the `get_user_balances` RPC).                                                            |
| `lookup_users`        | Match emails / usernames / full names → accounts. Built for reconciling spreadsheets of named donors.                |
| `get_stripe_txns`     | Stripe checkout records with depositor email, for cross-checking payouts.                                            |

## Setup

Env vars:

- `MCP_ADMIN_TOKEN` — long random secret; the admin URL path segment.
  Unset = admin endpoint disabled.
- `OPENAI_API_KEY` — already used for embeddings; enables semantic
  `search_projects`.

Apply the migration (`npx supabase migration up` locally, or push to prod),
then regenerate types (`bun run gen-types`) — after which the two
`(db.rpc as any)` casts in `register-tools.ts` can be properly typed.

Connect from Claude Code:

```bash
claude mcp add --transport http manifund https://manifund.org/api/mcp
claude mcp add --transport http manifund-admin https://manifund.org/api/mcp-admin/<token>/mcp
```

From claude.ai / Cowork: Settings → Connectors → Add custom connector, using
the same URLs.

## Future: per-user auth and writes

The eventual goal is for a regular user to authenticate to the MCP server as
themselves, so their agent can comment, donate, etc. on their behalf. The
intended path:

- Supabase Auth now ships an OAuth 2.1 authorization server (built for MCP).
  Manifund already uses Supabase Auth, so "log in with your Manifund
  account" from an MCP client is an integration, not a rebuild.
- `mcp-handler` supports this via its `withMcpAuth` wrapper: verify the
  bearer token → resolve the Supabase user → register write tools bound to
  that user's identity (mirroring existing endpoints like `place-bid`,
  `post-comment`, `transfer-money`).
- The three-tier shape would then be: public (anon) / per-user (OAuth) /
  admin (token or role check on the OAuth'd user).

## Known issues

- `bun run build`'s TypeScript check OOMs since adding `mcp-handler` +
  zod 3.25 — likely their types vs the repo's TypeScript 5.1.3. Parked;
  code compiles and runs. A TS upgrade is the probable fix.
- `register-tools.ts` uses an untyped Supabase client (see comment there):
  the aliased nested selects blow up supabase-js type inference.
