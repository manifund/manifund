# Notifications

Everything that happens to you on Manifund, in one list. Essential emails always go out right away; for everything
else, one choice: instant, daily or never. Comments' own rules for who is notified of a comment are in
`../comments/README.md` (C21-C25).

## What notifications are for

- **One record of what happened to you**: comments, money in and out, your projects' progress, receipts. The in-app
  list is the record; email is a copy.
- **Little to configure**: one email setting, on the notifications page itself ("we wanna cut the complexity a lot",
  Vals, 2026-10-14).
- **A base for subscriptions**: following people and saved searches create notifications the same way
  (`../follows/README.md`).

## How it's built

- **One `notifications` table** for every kind (a `reason`), with one nullable column per kind of source:
  `comment_id`, `project_id`, `bid_id`, `txn_id`, `withdrawal_request_id`, and the `amount` shown in the list.
- **Kinds in code** (`lib/notifications/kinds.ts`): every reason is essential or optional. `notification_email`
  stores one choice per person, only when it isn't the default (daily).
- **One writer per path**: comment notifications through `lib/comments` → `lib/notifications/record.ts` (sent by
  `send.ts` with its retry sweep); every other event through `lib/notifications/notify.ts`, which records the row and
  sends its email right away when it's due now. Notification failures never fail the event that caused them.
- **Daily summary**: rows waiting for it have `email_status = 'digest'`; a daily cron (`/api/notifications/daily`,
  14:00 UTC) sends one email per person and marks them sent.
- **How emails are built**: every email is a Postmark template; the templates (and so the look) live in Postmark,
  and code only fills their variables (`TEMPLATE_IDS` in `utils/email.ts`). The emails for people you follow, saved
  searches and the daily summary share one template, "notification" (`TEMPLATE_IDS.NOTIFICATION`): a bold first line
  (`heading`), `htmlContent`/`textContent` built in `lib/notifications/notification-email.ts`, a button
  (`buttonUrl`, `buttonText`), and, for optional emails only, a footer with Unsubscribe and "change how often"
  (`{{#footer}}`, filled by `templateEmail` in `notify.ts`). It copies the structure of "received project donation"
  (Vals, 2026-10-15: "better keep the current design all in postmark").

## Rules

- **N1** Every event that emailed someone before also shows in their notifications: money to you, money you gave,
  your projects, projects you follow, receipts and records, balance reminders, comments, people and searches you
  follow. Emails to an address with no profile behind it (a grant invitation, an external signatory, the admin
  inbox) stay email only.
- **N2** `/notifications` lists everything newest first, in one list with no tabs, filters or grouping; opening it
  marks everything read, and what was new keeps an orange mark until the next visit. The sidebar bell shows the
  unread count ("9+" above nine) and clears once the page has been opened.
- **N3** Essential notifications are always emailed right away and can't be turned off: money to you (donations,
  regranting budget, offers, grants, trades), money you gave (your offer became a donation, or came back),
  your projects' timeline (approved or declined, active, not funded, agreement to sign, update due, flagged,
  auction resolved), receipts and records (deposits, payments, withdrawals, cash moved to charity, signed
  agreements), and what needs you (an unfinished withdrawal, money left idle in your account, a moderator editing or removing your comment).
- **N4** Everything else is optional and follows one choice per person, in the title row of `/notifications`:
  "Instant" (each email as it happens), "Daily" (the default) or "Never". Optional: replies, mentions, comments on
  your projects and profile, updates and comments on projects you follow, projects you follow becoming active or
  closing, people you follow, saved-search matches, and tips on your comments. The choice is saved only by server code; people read
  only their own.
- **N5** The daily summary lists everything waiting for it, then marks it sent (or failed, with the reason, if
  Postmark refuses it); nothing is sent twice. What waits
  when someone switches to instant goes out in the next summary; what waits when they switch to never is
  dropped from email.
- **N6** Optional emails end with "Unsubscribe" (a signed link that sets the choice to never, with Undo, no sign-in
  needed) and "Change how often you get these emails" (the notifications page), plus one-click unsubscribe headers
  for mail apps. Opening the link changes nothing; only its button (or a mail app's one-click POST) does. Essential
  emails say nothing about unsubscribing.
- **N7** If recording or emailing a notification fails, the event that caused it still stands; the failure is
  logged.
- **N8** The weekly digest (`utils/weekly-digest.ts`, Mondays) isn't a notification: it keeps its own unsubscribe
  link (Postmark's), as before. It goes to everyone with karma 50 or more, everyone who has deposited $1,000 or
  more, and every regrantor; Postmark skips anyone who unsubscribed.

## Decisions

Newest first.

| Date       | Decided by                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Why                                                                                                                                         |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-16 | Vals                           | No link to the email setting from the edit-profile page (supersedes that part of 2026-10-07): the setting is in /notifications' title row and every optional email links to it | Keep the PR's changes to existing pages small |
| 2026-10-15 | Vals                           | The email choice sits in the page's title row, each choice explained in one sentence on hover; an orange mark shows what's new (day groups tried and dropped the same day: "not simple, not necessary"), money and your projects get an orange icon (N2, N4)                                                                                                                                                                                                              | Option A of the notifications page mockups: "A is good yeah let's do that"                                                                  |
| 2026-10-15 | Vals (team meeting)            | The first choice reads "Instant", not "Immediately": about the length of "Daily" and "Never", and still says each email goes out as it happens (N4); the stored value stays `immediate`                                                                                                                                                                                                                                                                                   | "find a word about same length as daily never so it looks better"                                                                           |
| 2026-10-14 | Vals                           | One email setting for optional notifications, immediately, daily or never, on `/notifications` itself; no settings page; essential emails (e.g. a project's timeline) always right away (N3, N4)                                                                                                                                                                                                                                                                          | "we wanna cut the complexity a lot ... only 1 setting for notifciations going to email (immediate, daily, never), there's no seperate page" |
| 2026-10-14 | Vals (Q38-Q40)                 | Default daily; the idle-balance reminder essential; tips on comments optional; offers and money you gave essential; the choice in its own table, not a profiles column (profiles are public)                                                                                                                                                                                                                                                                              | Daily is the closest to the earlier "activity weekly" default                                                                               |
| 2026-10-12 | Vals                           | Opening `/notifications` marks everything read; no marking one by one, no "Mark all read" (N2)                                                                                                                                                                                                                                                                                                                                                                            | "I don't like notifications being one by one as a feature, just cut. site it too low traffic for it to be a better flow rn."                |
| 2026-10-12 | Vals                           | Every optional group's email is right away or weekly; the daily summary goes (superseded 2026-10-14)                                                                                                                                                                                                                                                                                                                                                                      | "settings should be simplified to just right away or weekly"                                                                                |
| 2026-10-12 | Claude; Vals agreed 2026-10-13 | No "Off" in the settings: unsubscribing is the email's button, which covers the kinds that email is about (a weekly summary: all it lists); the settings show an unsubscribed group with neither choice picked. The weekly digest leaves the settings and keeps Postmark's own unsubscribe link, as on live (N7, N9)                                                                                                                                                      | Two choices everywhere, while every optional email can still be stopped from the email itself                                               |
| 2026-10-09 | Vals                           | The activity groups email weekly by default; money, your projects and reminders stay right away (N3)                                                                                                                                                                                                                                                                                                                                                                      | "only the follow and activity" (to: should every optional group default to weekly)                                                          |
| 2026-10-07 | Vals                           | Activity rows also offer weekly email (N6): "re activity notifications I'd add a weekly option too for email"                                                                                                                                                                                                                                                                                                                                                             | Some people want less email than daily                                                                                                      |
| 2026-10-07 | Vals                           | Settings page opens with one line: "Select which optional notifications you will also receive an email for. Manifund always sends emails for ..."; a link to the settings from the edit-profile page                                                                                                                                                                                                                                                                      | One place that says what's optional and what isn't; settings reachable where people expect account settings                                 |
| 2026-10-07 | Vals                           | Settings grouped coarsely: "replies, mentions, comments on your project & profile" and "updates & final reports, & comments on projects you follow" (instant / daily / off, weekly added later the same day; superseded 2026-10-12: right away or weekly); money to you is one toggle; money you gave fine; extend the reasoning to the other sections (N2, N3)                                                                                                           | "less choices and things to click through"                                                                                                  |
| 2026-10-07 | Vals                           | Settings show only optional groups, under "Select which optional notifications you will also receive an email for" (reworded 2026-10-12, Claude: every optional group now emails, right away or weekly), then "Manifund always sends emails for ..."; no locked rows, no bottom note; optional groups stay on by default (N4). Optional emails: a button to unsubscribe from that kind, or open the settings; always-sent emails mention nothing about unsubscribing (N7) | Fewer words; nothing to click that does nothing                                                                                             |
| 2026-10-07 | Vals                           | A moderator's edit always notifies, by email too, not switchable (N4)                                                                                                                                                                                                                                                                                                                                                                                                     | People always hear when someone changes their words                                                                                         |
| 2026-10-07 | Vals                           | The count goes on the bell icon, "like linkedin", not "Notifications (3)" (N10)                                                                                                                                                                                                                                                                                                                                                                                           | Familiar, takes less room                                                                                                                   |
| 2026-10-05 | Vals                           | Every kind of event in-app; email optional per kind; defaults keep today's emails "for now, tbd" (N1, N3)                                                                                                                                                                                                                                                                                                                                                                 | One record; fewer unwanted emails                                                                                                           |
| 2026-10-05 | Vals                           | No dropdown, no filters, no grouping of repeats in the first pass; click marks read plus "Mark all read" (N2; superseded 2026-10-12: opening the page marks all read)                                                                                                                                                                                                                                                                                                     | Simple first                                                                                                                                |
| 2026-10-05 | Vals                           | Instant for money and process events, instant / daily / off for activity (superseded 2026-10-12: right away or weekly for every optional group); settings at `/settings/notifications`; footer with "stop emails like this" and a settings link (N3, N7)                                                                                                                                                                                                                  |                                                                                                                                             |
| 2026-10-07 | Claude, tentative              | Stop links signed with a key derived from the service-role key, no expiry (N7)                                                                                                                                                                                                                                                                                                                                                                                            | No new secret to manage                                                                                                                     |

## Open questions

- **Older Postmark templates**: they receive `stopUrl` and `settingsUrl` but only show them once edited there (live
  configuration, not done); their footer link is Postmark's own unsubscribe, which stops all mail to that address on
  the stream. The "notification" template already uses Manifund's links.

## Later

- A filter on the inbox, if people start getting many notifications (few do today; Vals, 2026-10-07).

## Adding an event or a comment target

Every new kind of event goes through the same five places, so whoever adds one (a person or an agent) can follow
the rules above:

1. **A reason**: add it to the `notifications.reason` check in a new migration, and to `NotificationReason`.
2. **A source**: if the event is about something without a source column yet (e.g. an org), add a nullable column
   for it (`org_id`), one per kind of source, never a generic id.
3. **Essential or optional** (N3, N4): add the reason to `NOTIFICATION_REASONS` in `lib/notifications/kinds.ts`, and
   to `ESSENTIAL_REASONS` if it's about money, a project's timeline, a record, or something the person must act on.
4. **Recording it**: call `notify()` from the flow, after the flow itself succeeded (N8).
5. **Showing it**: one line in `lib/notifications/describe.ts` for the inbox and the email, and a test named after
   the rule it covers.

Example: reviews on org pages (`comments.org_id`, #283, 2026-10-08). Orgs have no owner yet (claiming is planned), so
there is nobody to tell about a new review; replies and mentions on a review notify through the shared reasons
(`reply_to_you`, `mention`), and the inbox labels and links them through `lib/comments/links`. Once orgs can be
claimed, add a reason such as `comment_on_your_org` for the org's admins, optional like other comments.

## Tests

- unit `tests/unit/notification-kinds.test.ts`: N3, N4;
- database `tests/db/notification-settings.test.ts`: N4;
- routes `tests/routes/notification-settings.test.ts`: N4, N6; `tests/routes/notifications-daily.test.ts`: N5;
  comments' `tests/routes/notifications.test.ts` (C21-C25) still passes, with N2.
- No tests yet: N1 per event (each flow's `notify()` call), N7.
