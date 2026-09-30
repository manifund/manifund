# Manifund caching architecture — findings & migration plan

**Audience:** an agent picking up this work. **Repo state:** `main` @ `ca5a4dd6`.
**Decisions already made by the repo owner:** target PPR (stream auth UI into a
static shell, not client-side auth); full sequenced migration is in scope; the 49
Pages Router API routes should eventually all be migrated.

---

## 0. How to verify any claim in this document

Every structural claim below was checked this way. Do the same before trusting
or extending it — several plausible-sounding assumptions turned out false.

```bash
bun run build
# route table: ○ = prerendered, ƒ = dynamic
cat .next/prerender-manifest.json | python3 -c \
  "import json,sys; print('\n'.join(sorted(json.load(sys.stdin)['routes'])))"
```

The prerender manifest is the ground truth for "did this actually become
static." Diff it before/after any change. Claims below are tagged
**[MEASURED]** or **[INFERRED]** — treat INFERRED as work to do, not fact.

---

## 1. What just landed (PR #192)

`/about/regranting-data` was a dynamic function with ~24s cold TTFB. It's now
prerendered ISR (`○ 5m 1y`). Three load-bearing changes:

1. `export const dynamic = 'force-static'` + `revalidate = 300` on the page.
2. **Removed `export const runtime = 'edge'` from `app/layout.tsx`.** Under edge,
   `force-static` silently does nothing — no error, the page just doesn't
   prerender. **[MEASURED]**
3. **Wrapped `<OAuthCodeHandler />` in `<Suspense>`.** It calls
   `useSearchParams()` (`components/oauth-code-handler.tsx:11`); unwrapped in the
   root layout, the build _fails outright_ the moment any route prerenders.
   **[MEASURED]** — build exits 1 with `useSearchParams() should be wrapped in a
suspense boundary at page "/404"`.

A cron-based cache-warming route was written and then dropped as unnecessary —
ISR's stale-while-revalidate already means nobody waits.

> One thing PR #192 does _not_ need, despite appearances: the
> `createServerSupabaseClient` → `createPublicSupabaseClient` swap. **[MEASURED]**
> — the page prerenders identically either way, because `force-static` makes
> `cookies()` return empty rather than error. It was kept for intent clarity.

---

## 2. Findings

### F1 — The binding constraint is the sidebar, not the runtime **[MEASURED]**

`app/sidebar.tsx:23` calls `createServerSupabaseClient()` → `cookies()`, and
`Sidebar` renders in the root layout. Without Cache Components, a request-time
API _anywhere_ in the tree forces the entire route dynamic. Suspense does not
help — that's precisely what PPR adds.

I tested removing `runtime = 'edge'` in isolation: the prerender manifest was
**byte-identical**. Not one additional page became static. Killing edge was
necessary to unblock the future, but it fixed nothing on its own.

**Implication:** every "make page X faster" task in this repo is blocked on the
same thing. Don't fix them one at a time.

### F2 — `force-static` is the only escape hatch today, and it's lossy **[MEASURED]**

`force-static` forces `cookies()` to return empty _for the whole route_, sidebar
included. The prerendered HTML for the ledger contains the logged-out sidebar:

```bash
$ grep -o 'href="/login"' .next/server/app/about/regranting-data.html
href="/login"
href="/login"
```

So a logged-in user hard-loading that URL sees "Login". (Soft nav is fine — the
root layout is preserved across client-side navigation.) This is acceptable for
one obscure page; it does not scale to `/projects/[slug]` or `/people`. **This
is the single strongest argument for PPR over more `force-static`.**

### F3 — ~19 `revalidate` exports are dead code **[MEASURED]**

24 route-segment-config lines exist on `main`; only the ledger's are live.
Everything else is inert because of F1. Three are worse than inert — they're in
files that aren't route segments at all, so they could never have worked:

- `app/sidebar.tsx:21` — `revalidate = 30`
- `app/projects/[slug]/vote.tsx:10` — `revalidate = 60`
- `app/projects/causes-section.tsx:7` — `revalidate = 86400`

Route segment config is only read from `page`/`layout`/`route`/`template`
files. These are plain components imported into pages. This is cargo-culting,
and it's evidence that the team's mental model of the caching system has drifted
from reality — worth correcting explicitly, not just deleting.

### F4 — `proxy.ts` runs on nearly every request, including cached pages **[INFERRED — verify first]**

`proxy.ts:25` calls `await supabase.auth.getClaims()`, with a matcher
(`proxy.ts:32`) that excludes only static assets. On Vercel, routing middleware
runs _before_ cache lookup, so even a CDN-cached ISR page should still pay this
hop. If `getClaims()` does a network round trip to Supabase Auth, that's a floor
under TTFB that no amount of page caching removes.

**Verify before acting:** whether the project uses asymmetric JWT signing (local
JWKS verification, fast) or symmetric (network call per request). Then measure
`x-vercel-cache` and middleware duration on a cached page. This could be the
single highest-value fix in the whole document, or a non-issue — I don't know
which, and neither should you until it's measured.

### F5 — There is one cache island, and it documents the Pages Router problem **[MEASURED]**

`db/project-cached.ts` wraps hot projects in `unstable_cache` with a
`hot-projects` tag and 1hr revalidate. Its `invalidateProjectsCache()` is
wrapped in a try/catch whose comment says it all:

> `revalidateTag` is an App Router-only API: called from a Pages Router API
> route it throws "Invariant: static generation store missing" and 500s the
> whole request. Swallow that so Pages Router callers survive.

This is the structural issue in miniature: **mutations live in Pages Router,
caches live in App Router, and they cannot talk to each other.** Any caching
strategy that depends on precise invalidation will hit this wall. It's why the
owner wants the Pages Router migrated.

### F6 — Pages interleave public and personalized data in one blocking fetch **[MEASURED]**

`app/projects/[slug]/page.tsx:39-60` is the canonical case: a single
`Promise.all` fetching the project (public, highly cacheable) alongside
`userProfile`, `userTxns`, `userBids` (per-user). The page carries
`revalidate = 0`. 16 pages call `getUser(supabase)`; 26 of 43 use the
cookie-reading client.

This is exactly the shape PPR is designed for, but it means the refactor is
per-page work: split each `Promise.all` into a cached public half and a
Suspense-wrapped personalized half. **Budget for this — it is the bulk of the
migration, not the flag flip.**

### F7 — Cache Components stage 1 is cheap **[MEASURED]**

I set `cacheComponents: true` and built. **21 errors, all one mechanical class:**

```
16 × Route segment config "revalidate" is not compatible with cacheComponents
 4 × Route segment config "runtime"
 1 × Route segment config "dynamic"
```

All 21 are deletions of code that already does nothing (F3). Genuinely easy.

### F8 — Stage 2's real blocker: the Supabase client is non-deterministic **[MEASURED]**

I deleted all 24 segment-config lines and rebuilt. The build then **compiled
and type-checked clean**, and got as far as static generation before dying. The
blocker is not Suspense boundaries. It is this:

**`createBrowserClient` / `createServerClient` / `createClient` from
`@supabase/*` call `Math.random()` internally.** Cache Components forbids
non-deterministic values during prerender. Every Supabase client construction on
the prerender path is therefore a build error.

Two distinct error shapes, hit in sequence:

**1. Client Components** — fatal at `/causes/[causeSlug]`:

```
Error: Route "/causes/[causeSlug]" used `Math.random()` inside a Client
Component without a Suspense boundary above it.
    at i (db/supabase-browser.ts:5:35)
    at <unknown> (db/supabase-provider.tsx:18:37)
```

`SupabaseProvider` builds its client in `useState(() => createClient())` during
render, and it wraps the entire app from the root layout.

**2. Server Components** — after probing past #1, fatal at `/finances`, having
reached **14 of 56 pages**:

```
Error: Route "/finances" used `Math.random()` before accessing either uncached
data (e.g. `fetch()`) or Request data (e.g. `cookies()`, `headers()`...).
    at <unknown> (db/supabase-admin.ts:8:10)
    at g (app/finances/page.tsx:26:20)
```

**Blast radius [MEASURED]:**

- All four client factories are affected: `db/supabase-admin.ts:8`,
  `db/edge.ts:13`, `db/supabase-server.ts:12` and `:32`, `db/supabase-browser.ts:5`.
- **59 files construct a Supabase client; 40 of them are in `app/`** — i.e.
  essentially the whole prerender surface.
- Fixing the provider lazily ripples into the context type and **17 files** that
  call `useSupabase()` and dereference `supabase` synchronously.

**Two important caveats on this number:**

1. **The build halts on the first failing page.** This is an iterative
   fix-and-rebuild loop, not a list you can enumerate in one run. "14/56" is
   where it stopped, _not_ "14 pages are fine and 42 are broken."
2. **Good news:** the root layout is already well Suspense-structured —
   `Sidebar`, `BottomNavBar`, `CompleteProfileBanner` and `OAuthCodeHandler` are
   each already wrapped (`app/layout.tsx:53-68`). The Suspense work I expected
   to dominate is largely done. The Supabase client determinism problem replaces
   it as the main cost.

**Revised verdict:** stage 2 is _not_ mechanical, but it is _concentrated_. It's
one root cause in a 5-line module surface, not 40 independent page bugs. Fix
client construction to be prerender-safe — construct inside `use cache` scopes,
or after a `connection()` / request-data read — and most of the 40 pages should
follow. That makes PR 4 a hard prerequisite for PR 6, not optional polish.

### F9 — Prerender-interrupt noise from API routes **[MEASURED, low priority]**

`app/api/embeddings/sync/route.ts:11` and `app/api/project-scores/sync/route.ts:16`
read `new URL(request.url)`, which logs `NEXT_PRERENDER_INTERRUPTED` during
build. Non-fatal — it's the bail-out mechanism working, and their try/catch
swallows it — but it pollutes build output and should be handled with
`connection()` or by reading `searchParams` properly.

### F10 — One edge holdout remains **[MEASURED]**

`app/projects/[slug]/opengraph-image.tsx:5` still sets `runtime = 'edge'`.
Cache Components does not support edge, so this must change before the flag can
be flipped. `ImageResponse` works on Node now; verify OG images still render.

---

## 3. Target architecture (if starting from scratch)

```
Request
  │
  ├─ Routing middleware: cheap, local JWT verification only. No network.
  │
  ├─ Static shell from CDN ─────────────────────── instant
  │    · page chrome, nav, public content
  │    · rendered from tagged, cached data
  │
  └─ Streamed dynamic holes (Suspense + PPR)
       · sidebar: profile, balance
       · per-page: your bids, vote state, edit affordances
```

Four properties the current code lacks:

1. **Auth is a hole, not a wrapper.** Nothing per-user is on the critical path
   to first byte. Today the sidebar is a wrapper, which is why nothing caches.
2. **One data layer, uniformly cached and tagged.** Today: one `unstable_cache`
   island and 40+ direct Supabase calls in components.
3. **Mutations invalidate their own caches inline.** Requires mutations to live
   where `revalidateTag` works — i.e. Server Actions / App Router.
4. **Cache config is real.** No inert `revalidate` exports; if a page declares a
   cache policy, that policy is in force and verifiable in the build output.

---

## 4. Migration sequence

Each step is independently shippable and independently valuable. **Do not skip
PR 2** — it converts the largest unknown into a number before anyone commits to
a timeline.

### PR 1 — Delete the dead caching config _(low risk, no behavior change)_

- Remove all 19 dead `revalidate` exports (F3), including the three in non-route
  files.
- Remove the three now-redundant `runtime = 'nodejs'` exports on MCP routes —
  Node is the default now that edge is gone from the layout.
- Migrate `app/projects/[slug]/opengraph-image.tsx` off edge (F10).
- **Verify:** prerender manifest unchanged; OG images still render.
- **Why first:** it's a prerequisite for the flag, it's pure deletion, and it
  stops the codebase from lying about its own caching behavior.

### PR 2 — Verify and fix the middleware cost _(independent, possibly the biggest win)_

- Resolve F4. Measure `getClaims()` on a cached page.
- If it's a network call per request, fix it — asymmetric JWT verification, or
  narrow the matcher so genuinely public paths skip the proxy entirely.
- **Independent of everything else.** Can run in parallel; do it early. If the
  Cache Components work stalls, this still stands on its own.

### PR 3 — Make Supabase client construction prerender-safe _(the critical path)_

This is F8, and it is the gate everything else passes through. The four
factories (`db/supabase-admin.ts:8`, `db/edge.ts:13`, `db/supabase-server.ts:12`
and `:32`, `db/supabase-browser.ts:5`) all call `Math.random()` internally, which
Cache Components rejects during prerender.

- **Server side:** construct clients inside cached scopes, or after a
  `connection()` / request-data read. The `db/` accessor layer is the right place
  to enforce this — callers shouldn't each have to remember.
- **Client side:** `db/supabase-provider.tsx:18` builds its client during render.
  Making it lazy is the obvious fix, but it changes the context type from
  `SupabaseClient` to `SupabaseClient | null` and **17 files call `useSupabase()`
  and dereference it synchronously**. Decide deliberately: nullable context and
  update all 17, or keep it non-null and defer differently (e.g. a module-level
  singleton constructed outside render).
- **Verify:** `cacheComponents: true` on a scratch branch, then rebuild
  repeatedly. The build halts on the _first_ failing page, so expect an
  iterative loop. Track progress by the `Generating static pages (n/56)` counter
  — the baseline probe reached 14/56.

### PR 4 — Consolidate the data layer

- Extend the `db/project-cached.ts` pattern across the `db/` modules: cached,
  tagged accessors for public reads (projects, profiles, causes, rounds, txns).
- Use React `cache()` for per-render dedup of repeated queries.
- Keep `unstable_cache` for now — it ports to `use cache` cleanly later.
- Naturally combines with PR 3: the same accessor layer that owns caching should
  own prerender-safe client construction.
- **Value even if the migration stalls here:** slow queries get cached, pages
  get faster, and nothing depends on the flag.

### PR 5 — Make auth a hole

- The root layout is **already** Suspense-structured (`app/layout.tsx:53-68`
  wraps `Sidebar`, `CompleteProfileBanner`, `BottomNavBar`, `OAuthCodeHandler`),
  so this is smaller than it looks. Mostly: give those boundaries real skeleton
  fallbacks instead of `null`, matching current dimensions to avoid layout shift.
- The per-page work is the larger half: split the mixed `Promise.all` blocks
  from F6 into a cached public fetch and a Suspense-wrapped personalized one,
  starting with `app/projects/[slug]/page.tsx:39-60`.
- Pre-PPR this won't make pages static yet. That's expected; it's the
  refactoring that makes PPR _possible_.

### PR 6 — Flip Cache Components

- `cacheComponents: true`, `'use cache'` on public pages/layouts, `cacheLife`
  profiles instead of `revalidate`, `cacheTag` instead of ad-hoc keys.
- Replace `force-static` on the ledger with `'use cache'` — this also fixes the
  logged-out-sidebar regression from F2, since the sidebar becomes a streamed
  hole.
- **Verify:** prerender manifest should finally show many `○` routes.
- **Watch for:** `<Activity>`-based navigation state preservation is on by
  default under this flag. Components stay mounted on back-navigation instead of
  unmounting. Test dropdowns, modals, and form state — this surfaces latent bugs.

### PR 7+ — Pages Router → App Router, prioritized by cache correctness

49 routes; do not do them alphabetically. Order by whether the route mutates
data that a cache depends on:

1. **First:** the 5 that write `'project donation'` txns —
   `pages/api/create-project.ts`, `transfer-money.ts`, `publish-project.ts`,
   `categorize-txns.ts`, plus `app/api/mcp/register-tools.ts`. These are what
   make the ledger and project pages go stale.
2. **Then:** project/profile mutations (`edit-project`, `create-grant`,
   `place-bid`, `post-comment`, `vote`).
3. **Last:** admin scripts, one-off backfills, Stripe webhooks — low cache
   impact, migrate opportunistically.

Each migrated route can call `revalidateTag` directly, and the try/catch in
`db/project-cached.ts:24-28` can be deleted when the last caller is gone.

---

## 5. Traps

- **`use cache` is not a distributed cache.** On serverless, runtime entries are
  in-memory per instance and don't reliably persist across requests. It's for
  getting data into the _static shell_. For genuine runtime caching across
  instances, that's `use cache: remote` (network hop + platform cost) — don't
  assume `'use cache'` alone replaces `unstable_cache` for hot runtime data.
- **`cacheComponents` deletes `dynamic`/`revalidate`/`fetchCache` entirely.** Any
  page still relying on them breaks. That's why PR 1 comes first.
- **Middleware runs regardless.** No amount of page caching removes the proxy
  hop. F4 is orthogonal — don't let PPR work mask it.
- **The build halts on the first bad page.** Under `cacheComponents`, one
  prerender error kills the build, so you cannot enumerate the work up front.
  Budget for an iterative fix-rebuild loop and track the
  `Generating static pages (n/56)` counter as your progress metric.
- **Verify with the manifest, not vibes.** Three confident-sounding assumptions
  in this investigation were wrong until a build disproved them: that removing
  edge would unlock ISR (it changed nothing), that the Supabase client swap was
  required (it wasn't), and that stage 2 would be dominated by missing Suspense
  boundaries (they were already in place; the real blocker was client
  determinism). Build and diff before believing anything here.

---

## 6. Open questions for whoever picks this up

1. Does `@supabase/ssr` have a supported way to construct a client
   deterministically, or does PR 3 have to work around `Math.random()` by
   controlling _where_ construction happens? Check upstream issues before
   designing the fix — this is a common Cache Components collision and there may
   already be a blessed pattern.
2. Is `getClaims()` a network call in this project's config (F4)?
3. Is the brief skeleton-then-fill for the sidebar acceptable on every page, or
   only below the fold? Affects how aggressive the Suspense boundaries can be.
4. Does anything depend on OG images being generated at edge (F10)?
