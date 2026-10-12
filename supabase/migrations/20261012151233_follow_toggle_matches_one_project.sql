-- The project page's Follow / Unfollow button calls toggle_follow, which calls unfollow_project. Both compared
-- `project_id = project_id AND follower_id = follower_id`: under `#variable_conflict use_variable` each side is the
-- function's parameter, so the condition was always true. toggle_follow therefore always took the unfollow branch
-- (whenever anyone followed anything), and unfollow_project deleted every follow the caller could delete (row-level
-- security limits that to their own), so the button never followed and cleared all of a person's follows.
-- Columns are now qualified by the table, parameters by the function name. Same signatures, still SECURITY INVOKER,
-- so the grants and row-level security on project_follows apply as before. Re-runnable.
CREATE OR REPLACE FUNCTION public.unfollow_project(project_id uuid, follower_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM project_follows pf
    WHERE pf.project_id = unfollow_project.project_id
      AND pf.follower_id = unfollow_project.follower_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_follow(project_id uuid, follower_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM project_follows pf
    WHERE pf.project_id = toggle_follow.project_id
      AND pf.follower_id = toggle_follow.follower_id
  ) THEN
    PERFORM unfollow_project(toggle_follow.project_id, toggle_follow.follower_id);
  ELSE
    PERFORM follow_project(toggle_follow.project_id, toggle_follow.follower_id);
  END IF;
END;
$$;
