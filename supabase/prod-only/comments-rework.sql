-- PRODUCTION ONLY, not applied locally (see README.md). Deploy the code first.

-- 1. Server-only writes to comments.
drop policy if exists "Enable insert for authenticated users only" on public.comments;

-- 2. Notifications come from lib/comments now.
drop trigger if exists "comment-notifications" on public.comments;

-- 3. The grant functions without comment inserts (the `_v2` functions in migration 20260930235920_comments_everywhere).
--    Old versions, once nothing calls them:
drop function if exists public.give_grant(public.project_row, public.comment_row, public.bid_row);
drop function if exists public.create_transfer_grant(public.project_row, public.comment_row, public.transfer_row, numeric);
drop function if exists public.execute_grant_verdict(boolean, uuid, uuid, uuid, jsonb);
drop function if exists public.execute_grant_verdict(boolean, uuid, uuid, uuid, jsonb, text);

-- 4. Server-only writes to reactions (the reactions route writes with the service role; tips through
--    tip_comment). Reading stays public.
drop policy if exists "Enable insert for authenticated users only" on public.comment_rxns;
drop policy if exists "Enable delete for users based on user_id" on public.comment_rxns;
