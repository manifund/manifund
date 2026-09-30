-- POC comments: moderation as decided with the team (2026-09-30). Additive only.
-- Authors can't delete (they edit, e.g. with strikethrough; every version stays public).
-- Moderators can edit a comment (history public, with a note) or remove it (placeholder with the
-- moderator's reason, mostly for private information; the text leaves public view).
-- Each version records who wrote it and the note that came with it.

alter table public.comments
  add column if not exists edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists edit_note text;      -- a moderator's note on the current version

alter table public.comment_revisions
  add column if not exists written_by uuid references public.profiles(id) on delete set null,
  add column if not exists note text;

create or replace function public.comments_keep_revision() returns trigger
language plpgsql as $$
begin
  if new.content is distinct from old.content then
    insert into public.comment_revisions (comment_id, content, written_at, written_by, note)
    values (old.id, old.content, coalesce(old.edited_at, old.created_at),
            coalesce(old.edited_by, old.commenter), old.edit_note);
    if new.deleted_at is null then
      new.edited_at := now();
    end if;
  end if;
  return new;
end $$;

-- The author hears when a moderator edits or removes their comment.
alter table public.notifications drop constraint if exists notifications_reason_check;
alter table public.notifications add constraint notifications_reason_check check (reason in (
  'reply_to_you', 'mention', 'comment_on_your_project', 'comment_on_your_profile',
  'progress_update', 'final_report', 'followed_project_comment', 'moderated_your_comment'));
