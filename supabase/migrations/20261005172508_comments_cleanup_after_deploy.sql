-- Comments everywhere, part 2: APPLY ONLY AFTER THE CODE FROM PR #275 IS DEPLOYED.
-- It removes what main's code still uses: applied while main's code is live, posting comments, reacting and giving
-- grants break on the site until the deploy. Order: 20260930235920_comments_everywhere.sql, then merge and deploy,
-- then this file, each in one transaction and recorded in the migration history under its own version.
--
-- What it removes: the open insert policies on comments and reactions (writes go through the server only); the
-- comment webhook (lib/comments notifies now); the old grant functions (the code calls the `_v2` ones). It also
-- labels past grant rationales (data).
--
-- Rolling the code back after this file breaks posting comments, reacting and giving grants, and old-code tips
-- could charge twice: restore these objects first (their definitions are in production's schema before this
-- file), or roll forward instead.
--
-- Tested on a fresh copy of production's schema and data (2026-09-30, 2026-10-05), in release order: the first
-- file, main's code still posting comments, replies, reactions, tips and grants; then the new code and its full
-- test suite; then this file and the suite again.

-- 1. Server-only writes to comments.
drop policy if exists "Enable insert for authenticated users only" on public.comments;

-- 2. Notifications come from lib/comments now.
drop trigger if exists "comment-notifications" on public.comments;

-- 3. The grant functions without comment inserts (the `_v2` functions in 20260930235920_comments_everywhere).
--    Old versions, once nothing calls them:
drop function if exists public.give_grant(public.project_row, public.comment_row, public.bid_row);
drop function if exists public.create_transfer_grant(public.project_row, public.comment_row, public.transfer_row, numeric);
drop function if exists public.execute_grant_verdict(boolean, uuid, uuid, uuid, jsonb);
drop function if exists public.execute_grant_verdict(boolean, uuid, uuid, uuid, jsonb, text);

-- 4. Server-only writes to reactions (the reactions route writes with the service role; tips through
--    tip_comment). Reading stays public.
drop policy if exists "Enable insert for authenticated users only" on public.comment_rxns;
drop policy if exists "Enable delete for users based on user_id" on public.comment_rxns;

-- 5. Label past grant rationales (data, one-off). main's grant functions inserted the rationale in the same
--    transaction as the project, so both got the same now(): a top-level, untyped comment whose created_at equals its
--    project's created_at is a rationale (68 in the 2026-09-28 production copy, 2023-06 to 2025-12; no other path
--    creates a comment and a project together). Must run in a later transaction than the first file: Postgres
--    can't use an enum value in the transaction that added it. Undo: set special_type back to null on the same rows.
update public.comments c
set special_type = 'grant rationale'
from public.projects p
where p.id = c.project
  and c.created_at = p.created_at
  and c.replying_to is null
  and c.special_type is null;
