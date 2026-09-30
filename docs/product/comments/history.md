# Comments: history

How comments used to work and how they changed. The current rules are in `README.md`.

## Timeline

| When | Change | Where |
|---|---|---|
| 2023-02 | Comments on projects, with the rich-text editor; one level of replies | PR #6 |
| 2023-03 | Email notifications for new comments | PR #9 |
| 2023-05 | A regrantor's reasoning becomes a comment, separate from the project description, "so recipients will be able to edit their project's description but not their donor's reasoning" | PR #35 |
| 2023-06 | Admin approval of grants, with a note to the creator posted as a comment | PR #37 |
| 2024-01 | Progress updates and final reports as special comments; a reminder after six months without an update | PR #77 |
| 2024-01 | Following projects: followers hear about top-level comments; commenting follows | PR #78 |
| 2024-03 | Reactions, including tips in charity money | PR #127 |
| 2025-05 | See who reacted | PR #150 |
| 2026-04 | Deleting a comment removes its replies (so an admin can wipe a spam account) | migration `20260417` |
| 2026-09/10 | The comments rework (below) | this branch |

## Before the rework

- **Only projects** took comments; the `comments` table required a project.
- **Posting** went through `/api/post-comment`, which trusted the type and the reply target sent by the browser.
- **Threads**: one level by convention only; a reply to a reply in the data would break the page.
- **Posting followed the project**, with an error if you already followed it.
- **Other flows inserted comments themselves**: the grant functions (the rationale, inside the grant's database
  transaction), the admin verdict (the note), closing a project (the final report, after the stage change).
- **Notifications**: a database webhook on every new comment called an email handler, which assumed the comment was
  on a project. Grant rationales and verdict notes likely sent two emails (the grant or verdict email, and "new
  comment"). No in-app notifications.
- **No editing, no history, no deleting by authors, no reports.** Admins could only wipe an account.
- **Mentions** linked to the username at the time of writing, so renamed people's old mentions led nowhere (31 of
  1,353 mentions in September 2026).
- **Display**: the comment card was built for projects (creator badge, "gave $X" tag); the profile page listed the
  comments a person wrote; the home feed showed recent comments on projects.

## The rework (2026-09/10)

What changed and why, in short. The decisions with dates are in `README.md`.

- **Comments everywhere**: profiles and programs, with one table and one column per target.
- **One writer** (`lib/comments`) and database rules for what must always hold; the old posting route, the webhook
  handler and the comment inserts inside grant functions are gone.
- **Edits with public history; moderation instead of deletion; reports** with an admin queue.
- **Notifications as data**: one per person per comment, in-app and by email, without the double emails.
- **Mentions by id**, the routes that write comments on the Node runtime, structured logs.

## Changed along the way

- 2026-09-28: every deletion (by the author or a moderator) would leave a placeholder. Replaced on 2026-09-30 by the
  team's decision that authors don't delete at all (C13) and moderators remove with a public reason (C16).
- 2026-09-28: comments on any cause. Narrowed on 2026-09-30 to programs only (C2).
