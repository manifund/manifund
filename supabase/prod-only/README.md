# Production SQL for the comments rework

Two steps around the deploy, so the site keeps working throughout.

1. **Before deploy:** `supabase/migrations/20260930235920_comments_everywhere.sql`. It only adds things or loosens
   them (new tables, columns, triggers, `_v2` grant functions; `comments.project` becomes nullable), so the code on
   main keeps running. Apply it in one transaction (`psql --single-transaction -f …`), then regenerate
   `db/database.types.ts` (`bun run gen-types`). One visible effect before the deploy: main's UI can no longer post a
   reply to a reply (the database refuses it; the new code files those under the top-level comment).
2. **Deploy** the code.
3. **After deploy:** `comments-rework.sql` here. It removes what only the old code used:
   - the open insert policy on `comments` (writes go through the server only);
   - the `comment-notifications` database webhook (its handler is gone; `lib/comments` notifies);
   - the old `give_grant`, `create_transfer_grant` and `execute_grant_verdict` (the new code calls the `_v2` ones).
     `scripts/create-acxg2025-grants.ts` still calls the old two; it is already stale (it fails if rerun) and would
     need the `_v2` functions;
   - the insert and delete policies on `comment_rxns` (reactions go through `POST /api/comments/:id/react`, with
     the service role; tips through `tip_comment`, which charges once).

Rolling back the code after step 3 breaks posting comments, reacting and giving grants: restore those objects
first (their definitions are in production's schema before step 3).

**Tested 2026-09-30** on a fresh copy of production's schema (the 2026-09-28 schema dump, checked identical to live
production that day by a read-only catalog comparison: tables, columns, functions, policies, triggers,
constraints, indexes):
- the migration applies in one transaction, and gives the same schema as the six POC migrations it replaces
  (only column order differs), plus `tip_comment` (added after that comparison: the whole file applies on the fresh copy, and the route tests exercise it);
- afterwards, a signed-in user can still post a comment and a reply the way main's code does, and a reply to a
  reply is refused;
- `comments-rework.sql` then applies, and removes the policies, the webhook and the four old functions; a direct
  insert from a signed-in user is then refused;
- `db/database.types.ts` is generated from the result of step 1 (plus the platform's `__InternalSupabase` header,
  which only the project-based generator writes), so `bun run gen-types` after step 1 should change nothing.
