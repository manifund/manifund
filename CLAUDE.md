# Manifund

Funding platform built with Next.js 16, TypeScript, Supabase, and Stripe.

## Quick Commands

```bash
bun run dev          # Dev server (turbo, production Supabase) - the normal one
bun run dev:dev      # Dev server (dev Supabase)
bun run dev:local    # Dev server (local Supabase via Docker) - rarely used, see below
bun run build        # Production build
bun run format       # oxfmt format all files
bun run gen-types    # Regenerate Supabase TypeScript types
```

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router + legacy Pages Router API routes)
- **Language:** TypeScript 5.1.3 (strict mode)
- **Database:** Supabase (PostgreSQL), no ORM - direct Supabase JS client
- **Auth:** Supabase Auth with Google OAuth
- **Payments:** Stripe
- **Styling:** Tailwind CSS with clsx for conditional classes
- **Package Manager:** Bun
- **Editor:** Tiptap (rich text / markdown)
- **Deployment:** Vercel

## Project Structure

```
app/              # Next.js App Router pages and API routes
  api/v0/         # Versioned API routes (App Router)
pages/api/        # Legacy API routes (Pages Router) - 49 serverless functions
components/       # Reusable React components
db/               # Database layer: Supabase clients, queries, generated types
  database.types.ts  # Auto-generated from Supabase (do not edit manually)
  supabase-server.ts # Server-side client (with cookies)
  supabase-browser.ts # Browser-side client
lib/              # Server actions (auth-actions.ts)
utils/            # Shared utilities (formatting, math, AMM calculations)
hooks/            # React hooks
supabase/         # Supabase config and SQL migrations
docs/             # Product docs (start at docs/README.md): intent, one folder per area with its rules; plans
proxy.ts          # Next.js 16 middleware (session refresh, JWT validation)
```

## Product docs

Before changing how an area behaves, read its doc in `docs/product/<area>/README.md` (rules have ids like `C12`;
tests name them) and update it in the same branch. How we work and write docs: `docs/README.md`.

## Code Style

- **oxfmt:** 2-space indent, no semicolons, single quotes, trailing commas
- **Files:** kebab-case (`profile-card.tsx`)
- **Components:** PascalCase (`ProfileHeader`)
- **Functions:** camelCase (`getProjectBySlug`)
- **Constants:** UPPER_SNAKE_CASE (`CENTS_PER_DOLLAR`)
- **Types:** PascalCase, often with compound/variant names (`FullProject`, `ProjectAndProfile`)
- **Imports:** Use `@/` path alias (maps to project root)
- **ESLint rules:** `@typescript-eslint/no-floating-promises: error`, `require-await: error`

## Key Patterns

### Server vs Client Components

Default to server components. Only use `'use client'` when interactivity is needed.

```typescript
// Server component (default)
import 'server-only'
export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params  // Next.js 16: params are async
  const supabase = await createServerSupabaseClient()
  // ...
}

// Client component
'use client'
export function InteractiveWidget() { ... }
```

### Next.js 16 Async Conventions

`params` and `searchParams` are Promises in Next.js 16 - always `await` them:

```typescript
const { slug } = await props.params
const { tab } = await props.searchParams
```

### Database Queries

Direct Supabase queries, no ORM. Types auto-generated from schema:

```typescript
const supabase = await createServerSupabaseClient()
const { data } = await supabase
  .from('projects')
  .select('*, bids(*), profiles(*)')
  .eq('slug', slug)
  .throwOnError()
```

### Styling

Tailwind utility classes with clsx for conditionals:

```typescript
className={clsx('px-4 py-2 rounded', color === 'emerald' && 'bg-emerald-500 text-white')}
```

## Environment Variables

Key variables are configured in `db/env.ts`. Uses multi-environment setup:

- `NEXT_PUBLIC_SUPABASE_ENV` switches between `'PROD'` and `'dev'`
- Separate Supabase URL/key pairs for prod and dev
- Stripe has live and test key pairs
- Local dev uses `.env.development.local`

## Database Migrations

**We push schema changes straight to the production database.** The local
Docker/Supabase path is not a well-supported route here - don't assume it works
or plan around it, and don't ask the user to start Docker.

```bash
# Write the migration SQL by hand into supabase/migrations/<timestamp>_name.sql,
# apply it to prod, then regenerate types from prod:
bun run gen-types    # reads the prod project (fkousziwzbnkdkldjper)
```

Because `gen-types` reads prod, `db/database.types.ts` cannot be regenerated
until the migration is actually applied. Applying DDL to prod is a real
production change - confirm with the user before doing it.

Note that RLS policies live only in the production project: there are **zero**
`CREATE POLICY` statements in `supabase/migrations/`, and the root `seed.sql`
that appears to define them is never loaded (`supabase/config.toml` points at
`supabase/seed.sql`, which doesn't exist). To see real policies, query
`pg_policies` on prod rather than trusting `seed.sql`.

```bash
# Legacy/local flow, kept for reference only:
npx supabase db diff --schema public --file migration_name
npx supabase migration up         # Apply locally
bun run gen-types:local           # Regenerate types from local
```

## Tests

Local only for now (not in CI): unit and database tests (`bun run test`, needs the local Supabase), route tests
against a running dev server (`bun run test:routes`), a few browser flows (`bun run test:e2e`, Playwright). Tests
name the product rules they check (`C12`…); `bun run test:rules` lists rules without a test. Details:
`tests/README.md`. Also verify changes with `bun run build`.

## Cron Jobs (Vercel)

- `close-grants` - daily 7 AM UTC
- `request-updates` - Mondays 3 PM UTC
- `embeddings/sync` - daily 8 AM UTC
- `weekly-digest` - Mondays 5 PM UTC
