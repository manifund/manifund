-- POC comments, step 1 (design/comments-build.md, migration A). Additive only.
-- New kinds for comments posted by server code paths, a database rule for one-level threads,
-- and indexes for the target and reply lookups.

alter type public.comment_type add value if not exists 'grant rationale';
alter type public.comment_type add value if not exists 'admin note';

-- One level of threading, whoever writes (the app's check is a convenience; this is the rule).
-- A reply answers a top-level comment on the same target, and is a plain comment.
create or replace function public.comments_check_reply() returns trigger
language plpgsql as $$
declare
  parent public.comments;
begin
  if new.replying_to is null then
    return new;
  end if;
  select * into parent from public.comments where id = new.replying_to;
  if not found then
    raise exception 'comments: reply to a missing comment';
  end if;
  if parent.replying_to is not null then
    raise exception 'comments: replies must answer a top-level comment';
  end if;
  if parent.project is distinct from new.project then
    raise exception 'comments: a reply must be on the same target as its parent';
  end if;
  if new.special_type is not null then
    raise exception 'comments: replies are plain comments';
  end if;
  return new;
end $$;

drop trigger if exists comments_check_reply on public.comments;
create trigger comments_check_reply
  before insert or update of replying_to on public.comments
  for each row execute function public.comments_check_reply();

create index if not exists comments_project_created_idx on public.comments (project, created_at desc);
create index if not exists comments_replying_to_idx on public.comments (replying_to);
