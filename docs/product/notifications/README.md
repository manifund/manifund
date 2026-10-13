# Notifications

Everything that happens to you on Manifund, in one list, with email as an optional copy you control per kind.
Comments' own rules for who is notified of a comment are in `../comments/README.md` (C21-C25).

## What notifications are for

- **One record of what happened to you**: comments, money in and out, your projects' progress, receipts. The in-app
  list is the record; email is a copy.
- **Fewer, clearer emails**: people choose, per group, whether to get an email right away or in one weekly summary
  ("less choices and things to click through", Vals, 2026-10-07; "just right away or weekly", 2026-10-12).
- **A base for subscriptions**: following people and saved searches create notifications the same way
  (`../follows/README.md`).

## How it's built

- **One `notifications` table** for every kind (a `reason`), with one nullable column per kind of source:
  `comment_id`, `project_id`, `bid_id`, `txn_id`, `withdrawal_request_id`, and the `amount` shown in the list.
- **Settings groups in code** (`lib/notifications/groups.ts`): every reason belongs to one group; each group is
  either always emailed or optional, with a default of right away or weekly (N3). `notification_settings` stores
  only what people change: `instant` or `weekly` from the settings page, `off` from an email's unsubscribe button. A
  stored value that isn't one of these counts as the group's default.
- **One writer per path**: comment notifications through `lib/comments` → `lib/notifications/record.ts` (sent by
  `send.ts` with its retry sweep); every other event through `lib/notifications/notify.ts`, which records the row and
  sends today's email right away when the setting says so. Notification failures never fail the event (a donation,
  a withdrawal) that caused them.
- **Weekly summary**: rows waiting for it have `email_status = 'digest'`; a cron on Mondays
  (`/api/notifications/weekly`) sends one email per person and marks them sent.

## Rules

- **N1** Every event that emailed someone before also shows in their notifications: money to you (donations,
  regranting budget, tips, offers, grants, trades), money you gave (a project you offered on became active or
  closed), your projects (approved or declined, active, not funded, agreement to sign, update due, flagged),
  projects you follow (active, not funded), receipts and records (deposits, payments, withdrawals, cash moved to
  charity, signed agreements), balance reminders. New offers on your proposal now show too (in-app only, as before
  no email). Emails to an address with no profile behind it (a grant invitation, an external signatory, the admin
  inbox) stay email only.
- **N2** Every reason belongs to exactly one settings group.
- **N3** Email follows the person's choice for the group: right away, or in the weekly summary. Without a choice,
  the activity and following groups (replies, mentions and comments on your things; updates and comments on
  projects you follow; people you follow; saved searches, `../follows/README.md`) wait for the weekly summary, and everything else is emailed right
  away, as before. Any other choice is refused.
- **N4** Some groups are always emailed and can't be turned off: a moderator editing or removing your comment
  (Vals, 2026-10-07), and receipts and records (assumption, see Open questions). The settings page shows only the
  optional groups, each with two choices, "Right away" and "Weekly", under "Choose when you get an email for each
  kind of notification: right away, or in one weekly summary", followed by one line naming what Manifund always
  emails. Settings are saved only by server code; people read only their own.
- **N5** `/notifications` lists everything newest first, with no tabs, filters or grouping, and opening it marks
  everything read; what was new stays highlighted until the next visit. There is no marking one by one.
- **N6** Every optional group offers the same two choices, right away or weekly. The weekly summary (Mondays) lists
  everything waiting for it, then marks it sent; nothing is sent twice. Whatever waits when a person switches to
  right away still goes out in the next weekly summary; whatever waits for a group they unsubscribed from (N7) is
  dropped from email.
- **N7** Optional emails end with an "Unsubscribe from these emails" button (a signed link that turns off email for
  the groups the email is about: its own group, or every group a weekly summary lists; with Undo, no sign-in needed)
  and a "Choose which emails you receive" link to the settings, plus one-click unsubscribe headers for mail apps.
  Opening the link changes nothing; only its button (or a mail app's one-click POST) does, so link scanners can't
  unsubscribe people. An unsubscribed group shows in the settings with neither choice picked; picking one emails it
  again. Always-sent emails say nothing about unsubscribing: no button, no link, no headers.
- **N8** If recording or emailing a notification fails, the event that caused it still stands; the failure is logged.
- **N9** The weekly digest (`utils/weekly-digest.ts`, Mondays) isn't a notification and has no settings row: it
  carries its own unsubscribe link (Postmark's, for its broadcast stream), as before.
- **N10** The unread count shows as a badge on the sidebar's bell (C25), "9+" above nine. It clears once the person
  has opened `/notifications`, without a page reload.

## Decisions

Newest first.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-12 | Vals | Opening `/notifications` marks everything read; no marking one by one, no "Mark all read" (N5) | "I don't like notifications being one by one as a feature, just cut. site it too low traffic for it to be a better flow rn." |
| 2026-10-12 | Vals | Every optional group's email is right away or weekly; the daily summary goes (N3, N6) | "settings should be simplified to just right away or weekly" |
| 2026-10-12 | Claude; Vals agreed 2026-10-13 | No "Off" in the settings: unsubscribing is the email's button, which covers the kinds that email is about (a weekly summary: all it lists); the settings show an unsubscribed group with neither choice picked. The weekly digest leaves the settings and keeps Postmark's own unsubscribe link, as on live (N7, N9) | Two choices everywhere, while every optional email can still be stopped from the email itself |
| 2026-10-09 | Vals | The activity groups email weekly by default; money, your projects and reminders stay right away (N3) | "only the follow and activity" (to: should every optional group default to weekly) |
| 2026-10-07 | Vals | Activity rows also offer weekly email (N6): "re activity notifications I'd add a weekly option too for email" | Some people want less email than daily |
| 2026-10-07 | Vals | Settings page opens with one line: "Select which optional notifications you will also receive an email for. Manifund always sends emails for ..."; a link to the settings from the edit-profile page | One place that says what's optional and what isn't; settings reachable where people expect account settings |
| 2026-10-07 | Vals | Settings grouped coarsely: "replies, mentions, comments on your project & profile" and "updates & final reports, & comments on projects you follow" (instant / daily / off, weekly added later the same day; superseded 2026-10-12: right away or weekly); money to you is one toggle; money you gave fine; extend the reasoning to the other sections (N2, N3) | "less choices and things to click through" |
| 2026-10-07 | Vals | Settings show only optional groups, under "Select which optional notifications you will also receive an email for" (reworded 2026-10-12, Claude: every optional group now emails, right away or weekly), then "Manifund always sends emails for ..."; no locked rows, no bottom note; optional groups stay on by default (N4). Optional emails: a button to unsubscribe from that kind, or open the settings; always-sent emails mention nothing about unsubscribing (N7) | Fewer words; nothing to click that does nothing |
| 2026-10-07 | Vals | A moderator's edit always notifies, by email too, not switchable (N4) | People always hear when someone changes their words |
| 2026-10-07 | Vals | The count goes on the bell icon, "like linkedin", not "Notifications (3)" (N10) | Familiar, takes less room |
| 2026-10-05 | Vals | Every kind of event in-app; email optional per kind; defaults keep today's emails "for now, tbd" (N1, N3) | One record; fewer unwanted emails |
| 2026-10-05 | Vals | No dropdown, no filters, no grouping of repeats in the first pass; click marks read plus "Mark all read" (N5; superseded 2026-10-12: opening the page marks all read) | Simple first |
| 2026-10-05 | Vals | Instant for money and process events, instant / daily / off for activity (superseded 2026-10-12: right away or weekly for every optional group); settings at `/settings/notifications`; footer with "stop emails like this" and a settings link (N3, N7) | |
| 2026-10-07 | Claude, tentative | Stop links signed with a key derived from the service-role key, no expiry (N7) | No new secret to manage |

## Open questions

- **Which emails can't be turned off** (Vals: tbd). Built: moderation (decided) and receipts and records (assumption).
- **Postmark templates**: most emails use templates stored in Postmark. They receive `stopUrl` and `settingsUrl`
  but only show them once the templates are edited there (live configuration, not done).
- **The weekly summary's time** (Mondays, 14:00 UTC).

## Later

- A filter on the inbox, if people start getting many notifications (few do today; Vals, 2026-10-07).

## Adding an event or a comment target

Every new kind of event goes through the same five places, so whoever adds one (a person or an agent) can follow
the rules above:

1. **A reason**: add it to the `notifications.reason` check in a new migration, and to `NotificationReason`.
2. **A source**: if the event is about something without a source column yet (e.g. an org), add a nullable column
   for it (`org_id`), one per kind of source, never a generic id.
3. **A settings group** (N2): put the reason in exactly one group in `lib/notifications/groups.ts`. A comment on
   something the person owns joins "Replies, mentions, and comments on your projects and profile" (rename the row if
   the list grows); records of money stay "always" (N4).
4. **Recording it**: call `notify()` from the flow, after the flow itself succeeded (N8).
5. **Showing it**: one line in `lib/notifications/describe.ts` for the inbox and the email, and a test named after
   the rule it covers.

Example: reviews on org pages (`comments.org_id`, #283, 2026-10-08). Orgs have no owner yet (claiming is planned), so
there is nobody to tell about a new review; replies and mentions on a review notify through the shared reasons
(`reply_to_you`, `mention`), and the inbox labels and links them through `lib/comments/links`. Once orgs can be
claimed, add a reason such as `comment_on_your_org` for the org's admins in the "replies, mentions and comments"
group.

## Tests

- unit `tests/unit/notification-groups.test.ts`: N2, N3, N4;
- database `tests/db/notification-settings.test.ts`: N3, N4;
- routes `tests/routes/notification-settings.test.ts`: N3, N4, N7; `tests/routes/notifications-weekly.test.ts`: N6;
  comments' `tests/routes/notifications.test.ts` (C21-C25) still passes, with N5.
- No tests yet: N1 per event (each flow's `notify()` call), N8.
