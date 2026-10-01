# Comments

What people write about something on Manifund: a project, a person, a program. How it used to work and how it
changed: `history.md`.

## What comments are for

- **The evaluative discussion of a project**: questions, answers, regrantors' reasoning, worries, creators'
  responses. It's where judgment happens in public.
- **Reasoning behind money.** A regrantor's rationale for a grant is a comment the grantee can't edit; after donating
  or voting, people are invited to say why.
- **Accountability.** Progress updates and final reports are comments by the project's creator.
- **Reputation.** Comments on people's profiles (vouches, appraisals) and on programs (questions about a round,
  feedback on a fund's choices) add to the public record.
- **Staying informed.** Followers, mentioned people and the people answered hear about new comments.
- **Signal.** Comments count toward a project's ranking; notable ones go in the weekly digest; agents read them
  through the API and MCP server.

## How it's built

- **One `comments` table** for every target, with **one explicit column per target** (`project`, `profile_id`,
  `cause_slug`) and a check that exactly one is set. Each row says plainly what it's about; foreign keys cascade.
  (We chose this over a generic `target_type` + `target_id` pair, which loses foreign keys, and over a separate
  `discussions` table, which adds a hop nobody needs yet.)
- **One writer.** Only server code in `lib/comments` writes comments (post, edit, moderate, report), with one rules
  file per target (`lib/comments/targets/`: who may post what, who gets notified, how it's labelled). The database
  refuses direct writes from browsers.
- **The database guards what must always hold**: one target, one level of replies on the same target, and a copy of
  the old version on every change of a comment's words.
- **Side tables belong to comments only**: `comment_revisions` (past versions), `comment_reports`, `comment_rxns`
  (reactions). Other objects (e.g. project descriptions) will have their own history, shaped their own way.
- **Content** is the editor's JSON document (Tiptap); mentions are nodes holding the person's id.
- **Notifications are data**: a `notifications` table, one row per person per comment, used for the in-app list and
  for email (sent right after the response, with a cron as a backup).
- **One component** (`components/comments/comments-section.tsx`) shows threads and the composer on project, profile
  and program pages.

## Rules

Ids are stable once merged: tests name them, and a removed rule keeps its id in `history.md`. Rules marked
*(not built yet)* are decided but not yet in the code.

### Targets

- **C1** A comment is about exactly one thing: a project, a person's or an organization's profile, or a program.
  (A fund's account shows its program page, so funds take comments as programs.)
- **C2** Programs take comments (funds and rounds, e.g. Falcon Fund, ACX Grants); topic causes (e.g. Science &
  technology) don't. A cause is a program when it's a prize round or has a fund.

### Posting

- **C3** Only signed-in people post. Everything goes through `lib/comments`.
- **C4** A comment is what the editor produces, with some text (or a mention or an image), up to 10,000 words (far
  above anything written so far, so it never gets in the way of real comments). A longer one is refused with a
  message saying so, and the attempt is logged for review.
- **C5** A comment can be a plain comment, or have a type: a progress update (by the project's creator), a final
  report, a grant rationale or an admin note. Only progress updates are posted from the comment box; the others come
  from their own flows (closing a project, giving a grant, an admin's verdict). Only top-level comments have a type.
- **C6** Hidden and draft projects take no comments (a draft's creator can't comment on it before publishing).
- **C7** Commenting on a project follows it.
- **C8** On a profile, the person can reply to comments but not start a thread (their own words go in their About
  section).
- **C9** Rate limits, set so that normal use never meets them: they're there to stop floods. Refusals say which
  limit and when to try again (the text stays in its editor). Server flows (grant rationale, admin note, final
  report) aren't limited.

  | What | Limit | Admins get a warning when someone passes, in a day |
  |---|---|---|
  | Comments on projects and programs | 30 per 5 minutes | 60 |
  | Comments on profiles | 10 per 5 minutes | 30 |
  | Reports | 10 per 5 minutes | 20 |

  For scale (up to September 2026): the busiest people wrote 7 comments in 5 minutes and 23 in a day; a fund's
  account posting a batch, 22 and 39.

  (Later, agents that watch for unusual behaviour can take over from the warnings.)
- **C10** Nobody loses what they wrote: when a comment, an edit, a report, a progress update or a final report is
  refused or fails, the text stays in its editor (drafts are also kept in the browser).

### Threads

- **C11** One level of replies. Replying to a reply posts under the top-level comment, starting with an @mention of
  the person answered.

### Editing and history

- **C12** Authors can edit their comments at any time. Every version stays public: an "edited" marker opens all of
  them, whole (no diff), newest first.
- **C13** Authors can't delete a comment; they can edit it (e.g. strike through what they retract).
- **C14** Every change to a comment's words keeps the previous version, recording who wrote each version.

### Moderation

- **C15** Moderators (admins) can edit any comment, with a public note; it then shows as "edited by a moderator" and
  the history marks that version with the note.
- **C16** Moderators can remove a comment, with a public reason (meant mostly for private information). It shows as
  "Removed by a moderator: <reason>"; its replies stay, and the thread takes no new replies. The removed text is
  readable only by admins.
- **C17** The author is told (in the app and by email) when a moderator edits or removes their comment.
- **C18** Spam accounts can still be wiped entirely by an admin (their comments deleted).

### Reports

- **C19** Anyone signed in can report someone else's comment, once, with an optional note and a "this is spam"
  toggle. Reporters see only their own reports.
- **C20** Admins see open reports per comment (the comment, its author, a link, the notes). They dismiss them (the
  comment stays; the reports are marked dismissed, kept for later), or remove the comment with a public reason, which
  closes the reports too.

### Reactions

- **C35** People react to comments with emoji, once per emoji (reacting again takes it back). Three reactions are
  tips (🧡 $1, 🏅 $10, 🏆 $100 of charity money, to the commenter). A tip moves the money exactly once, together
  with its reaction: a repeated request (a double click, a direct API call) doesn't charge again. A tip can't be
  taken back. You can't tip your own comment (it isn't offered, and the server refuses it).

### Notifications

- **C21** Each new comment notifies each person at most once, for the strongest reason: a reply to you, a mention of
  you, a comment on your project or profile, a progress update or final report on a project you follow, a comment on
  a project you follow. Nobody is notified of their own comment.
- **C22** Who hears about what:
  - project: its creator; followers (top-level comments); the person replied to; mentioned people;
  - profile: the person; the person replied to; mentioned people;
  - program: the person replied to; mentioned people (programs have no owners).
- **C23** No double emails for one event. When a regrantor gives a grant, the recipient already gets a "you received
  a grant" email, and when an admin approves or rejects a proposal, its creator gets a verdict email. The rationale
  and the admin's note posted with them are comments too, so they would also trigger a "new comment on your project"
  email; instead, the creator gets only the in-app notification for them.
- **C24** Emails go out right after the comment is saved; failures are retried, and a check every 10 minutes sends
  what was missed and raises an alert when something has waited over 30 minutes. If notifications fail, the comment
  still stands (and the failure is logged).
- **C25** `/notifications` lists a person's notifications, newest first, and marks them read; the sidebar shows how
  many are new.

### Comments posted by other flows

- **C26** Giving a grant: the money and the project are saved together; the rationale is then posted as a "grant
  rationale" comment. If that fails, the grant stands and the regrantor is asked to post the rationale again.
- **C27** An admin's verdict on a proposal, with a note: the note becomes an "admin note" comment.
- **C28** Closing a project: the final report is saved before the project completes, so a report that fails leaves
  the project open. Only its creator can close it.

### Display and data

- **C29** Project comments keep the creator badge and "gave $X" tags; after donating or voting, the comment box
  invites people to say why.
- **C30** A profile shows the comments on it and, in a second tab, the comments the person wrote elsewhere (on every
  other target). Their replies on their own profile stay with their threads in the first tab.
- **C31** The home feed includes comments on every target, tagged with where they were posted (and, for a reply,
  whom it answers); comments on hidden projects and removed comments stay out. Filters show only updates (progress
  updates and final reports), grant reasoning, or discussion (plain comments). The weekly digest covers project
  comments. *(Planned: search, and filters by where and tag.)*
- **C32** Mentions show the person's current username and link to their profile even after a rename.
- **C33** The public API returns each comment's target (`project`, `profile_id` or `cause_slug`), type, and edit and
  removal fields; a removed comment has no content.
- **C34** Posting, editing, moderation, reports, refusals for limits and notifications write structured log lines.

## Decisions

Newest first. Everything here is also reflected in the rules above.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-09-30 | Val | Word limit of 10,000 words for every comment (C4) | Never triggers normally: the longest comments so far are ~3,800 words (a progress update) and ~2,200 (thoughtful funding reasoning) |
| 2026-09-30 | Val | Rate limits never meet normal use (C9); the numbers are Claude's proposal from real use | Stop floods only |
| 2026-09-30 | Val | Rate limits per 5 minutes, with a daily threshold that warns admins (C9); refusals explain themselves and never lose the text (C9, C10) | Stop floods without blocking normal use; watch for odd behaviour |
| 2026-09-30 | Val | A word limit, with refused attempts logged for review (C4) | Very long comments are rare and worth a look |
| 2026-09-30 | Val | Removing a reported comment always closes its reports; no "keep open" option (replaces the toggle decided earlier the same day) | Simpler; the follow-up case hasn't come up |
| 2026-09-30 | Val | Acting on a reported comment has an "also close the reports" toggle (C20); replaced the same day, see above | Sometimes a report needs a follow-up after acting |
| 2026-09-30 | Val | Profile comments stay plain for now: no separate vouch type | Simple by default; revisit once people use them |
| 2026-09-30 | Val | Tags people choose (recommendation, question, concern, evaluation), for search and filters: planned | Let readers find the kind of comment they want |
| 2026-09-30 | Val | Evaluations of projects shelved: comments only for now | Scope |
| 2026-09-30 | Team | Only programs take cause comments, not topic causes (C2) | Topics are categories; programs have people and decisions to discuss |
| 2026-09-30 | Team | No deletion by authors; moderators edit with a note or remove with a reason (C13, C15-C17) | Transparency: what was said stays on record; removal is for private information |
| 2026-10-01 | Val | Past grant rationales get their label at deploy; the comments feed's pager counts what it shows, up to 7 pages as before (C31) | The "Grant reasoning" filter should find the history too |
| 2026-09-30 | Val | No tipping your own comment (C35) | Sending yourself money is confusing; none in production so far |
| 2026-09-30 | Val | No commenting guidelines on profiles for now (C8) | Don't solve a problem before it appears; fewer words |
| 2026-09-28 | Val | Reports: optional note and a spam toggle, no reason list (C19) | Simple by default |
| 2026-09-28 | Val | Profile owner replies but doesn't start threads; profile comments in the home feed; owner notified (C8, C22, C31) | Their own words go in their profile; comments about them are public discussion |
| 2026-09-28 | Val | Agents may not comment on people | Comments about people need a person behind them (not built yet: see below) |
| 2026-09-28 | Val | Notifications as a table; sent after the response with a cron backup; a failure doesn't fail the comment (C21-C25) | One path for every comment; in-app list and email settings on the same rows |
| 2026-09-28 | Val | Server-only writes through `lib/comments`; grant functions stop inserting comments (C3, C26-C28) | One place for the rules; money stays atomic, comments don't need to be |
| 2026-09-28 | Val | Mentions by user id (C32) | Renamed users' mentions broke |
| 2026-09-28 | Val | One level of threads (C11) | Enough in practice; simpler to read |
| 2026-09-28 | Val | Edit history as whole past versions, no diff (C12) | Simple by default |
| 2026-09-28 | Val | Comments have their own history, not a shared "text with history" unit | Less interconnection; project descriptions will want a different, structured history |
| 2026-09-28 | Val | Avoid type-specific data on comments (evaluation scores, if they come, get their own table) | Most comments share one structure |
| 2026-09-28 | Val | One comments table with one column per target | Clear what each row is about; real foreign keys; simple to query |
| 2026-09-28 | Val, with Austin | Comments everywhere (profiles, programs), starting with profiles | Reputation is built from what others say about people and programs |

## Open questions

- **Numbers proposed by Claude, not yet reviewed by the team**: the rate limits (C9) and the order of notification
  reasons (C21).
- **What commenting on a profile is for (C8)**: vouches only, or also concerns? Calling the section "vouches" would
  make it clearer, but would rule out negative information (Val, 2026-09-30).

## Later

- **Tags** people choose (see Decisions); a search and filter bar on the feed (C31).
- **Agents** can't comment on people: needs profiles to say who is an agent.
- **Notification settings**: a settings page where each person turns emails on or off, and moving Manifund's other
  emails (about 24 kinds) onto notifications so they also show in the app. Until then some things only email, which
  is fine.
- **Following** people and programs, and more thought on what following a project should mean (C7).
- **Vouches** as their own kind of profile comment, if plain comments turn out not to be enough (see Decisions).
- **Evaluations** of projects (shelved), with their own table.
- **The home feed**, reworked once comments on people and programs show up in it at volume.
- **Errors in PostHog**: today only thrown errors reach PostHog; the failures the comment code handles itself are
  only log lines. Worth a ping: notifications that couldn't be recorded (nobody hears about the comment), emails
  that fail or stop going out (with bounced addresses counted as skipped), database failures on posting, editing,
  removing or reporting, a grant's rationale or an admin's note that wasn't saved, a failed verdict, attempts over
  the word limit, and a failed follow after commenting. Also: check that a removal cancelled the comment's pending
  emails, refuse a second final report if closing a project fails halfway, and answer database outages with a 500
  rather than the database's own message.

## Tests

Run locally (not in CI yet): see `tests/README.md`. Each test names the rules it checks.

- **Logic**: C4 (content checks), C21 (one notification per person, strongest reason), links and labels (C32).
- **Database**: C1, C11 (threading), C14 (versions kept, with who wrote them), C16 (removed text hidden), C19 and
  C25 (people see only their own reports and notifications), C24 (two senders never email the same notification),
  C3 (no direct writes from browsers, with the production-only rules applied).
- **Routes**: C2, C3, C5, C6, C8, C9, C12, C13, C15-C17, C19, C20, C26-C28, and the pages and API shape (C30, C31,
  C33).
- **Browser**: posting and replying, editing and the history, a moderator removal, a profile comment, notifications,
  and that a refused comment keeps its text (C10).
- **Unchanged behaviour**: creator badges and "gave $X" tags, reactions and tips, progress updates and the six-month
  reminder, grants with rationales, admin verdicts, the donation "Reply", follows, account wipes, the regranting data
  page, ranking and digest counts, API pagination.
