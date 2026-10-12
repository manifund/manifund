-- Following a project you already follow is a no-op.
-- follow_project was a plain INSERT into project_follows (primary key project_id, follower_id), so every caller
-- that follows after the fact failed for someone who already followed: an upvote (pages/api/vote.ts), a repeat
-- donation (transfer-money), a second offer (handle-new-bid) or trade. The vote, money or offer was already saved;
-- the person got an error. Same signature, so callers and grants are unchanged; re-runnable.
CREATE OR REPLACE FUNCTION public.follow_project(project_id uuid, follower_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_variable
BEGIN
    INSERT INTO project_follows (project_id, follower_id)
    VALUES (project_id, follower_id)
    ON CONFLICT DO NOTHING;
END;
$$;
