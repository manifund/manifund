-- PRODUCTION ONLY, not applied locally (see README.md). Deploy the code first.

-- 1. Server-only writes to comments.
drop policy if exists "Enable insert for authenticated users only" on public.comments;

-- 2. Notifications come from lib/comments now.
drop trigger if exists "comment-notifications" on public.comments;

-- 3. The grant functions without comment inserts (bodies: migration *_poc_comments_grant_functions_v2).
--    Old versions, once nothing calls them:
drop function if exists public.give_grant(public.project_row, public.comment_row, public.bid_row);
drop function if exists public.create_transfer_grant(public.project_row, public.comment_row, public.transfer_row, numeric);
drop function if exists public.execute_grant_verdict(boolean, uuid, uuid, uuid, jsonb);
drop function if exists public.execute_grant_verdict(boolean, uuid, uuid, uuid, jsonb, text);
