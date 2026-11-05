# Security incident: `Manifund_Support` impersonation / credential phishing

**Date:** 2026-11-04 · **Author:** Claude (w/ Austin) · **Status:** Account superbanned and
verified removed in prod; hardening follow-ups open

## Summary

An account registered as `Manifund_Support` ("Manifund Support") spammed 82 project
comment threads in 33 minutes with a message impersonating a "Manifund Trust & Safety
Team" account-restriction notice, directing recipients to a phishing link disguised as
`manifund.org`. The account was reported by two users, hit the comment rate limiter at
least twice, and was removed by superban. No money moved and no credentials are known to
have been captured.

## Timeline (UTC, 2026-11-04)

| Time | Event |
| --- | --- |
| 22:26:23 | Account created, email signup (`laliqekuqi42@gmail.com`) |
| 22:26:34 | Email confirmed, first and only sign-in |
| 22:32:10 | First phishing comment posted |
| ~22:37–22:52 | ~15 min gap — consistent with hitting the 30-comments-per-5-min project limit |
| ~22:55–23:02 | Second gap, same cause |
| 23:05:35 | Last phishing comment (82nd) |
| — | 2 users filed comment reports |
| 2026-11-04 (this session) | Evidence captured, account superbanned |

## Actor

| Field | Value |
| --- | --- |
| Profile ID | `abc05510-3491-438b-900f-4ed10b717895` |
| Username | `Manifund_Support` |
| Display name | `Manifund Support` |
| Email | `laliqekuqi42@gmail.com` (gmail, random-string local part) |
| Auth provider | `email` (not Google OAuth) |
| Created | 2026-11-04 22:26:23 UTC |
| Karma | 0 |
| Projects / bids / txns / reactions | 0 / 0 / 0 / 0 |
| Bio, website, long description | empty |
| Avatar | uploaded (default-generated identicon URL) |

The account did nothing but post the 82 comments. It held no balance and never
participated in funding, so removal had no financial side effects.

## The payload

All 82 comments were byte-identical, each on a different project, none a reply.
Reproduced here as evidence — **this is the attacker's text, not a Manifund notice:**

> Dear User,
>
> Your Manifund account has been restricted due to incomplete verification of the bank
> information associated with your profile. As this verification has not been
> successfully completed, recent transactions have failed to meet our compliance and
> security requirements.
>
> Effective immediately, the following restrictions have been applied to your account:
>
> 1. Your profile and all associated projects have been removed from public view
> 2. You are prohibited from receiving new contributions or launching new projects
> 3. All fund withdrawals have been suspended
>
> You are required to complete the verification process without delay by accessing your
> account at the link below and following the provided instructions:
>
> 🔗 `https://manifund.org@share.google/dtG6j79TozcmklqIk`
>
> Failure to complete the required verification may result in continued restrictions or
> permanent suspension of your Manifund account.
>
> Manifund Trust & Safety Team

### Why the link works as a lure

`https://manifund.org@share.google/dtG6j79TozcmklqIk` uses the URL **userinfo** field:
everything before the `@` is a username, so the actual host is `share.google`, with
`manifund.org` as decoration. A reader scanning left to right sees `manifund.org` first.
`share.google` is a Google URL-shortener domain, so the destination was redirected and
is not recorded in our data.

The link was **not** followed during this investigation, so the landing page is
uncharacterized. Given the pretext ("verify bank information"), the likely targets are
Manifund login credentials and/or bank details.

### Social-engineering notes

- Impersonates a Manifund staff function ("Trust & Safety Team") that does not exist as a
  real account; the username `Manifund_Support` is designed to pass as official.
- Targets the one thing Manifund users care about: access to grant money they are
  raising or have raised.
- Threatens escalating loss ("permanent suspension") with urgency ("without delay").
- Chose comment threads on *proposal-stage and active* projects, i.e. people with live
  fundraising or disbursed funds — the users most likely to panic.

## Blast radius

**Comment threads:** 82 projects, 1 comment each (one project per comment — no thread was
hit twice). 72 proposal-stage, 10 active. 78 distinct project creators.

**Notifications generated:** 204 rows across 154 distinct recipients (project creators,
thread followers, and followers of the commenter).

| `email_status` | Notifications | People |
| --- | --- | --- |
| `digest` | 188 | 149 |
| `skipped` | 14 | 3 |
| `sent` | 2 | 2 |

**Only 2 people received an immediate email.** The other 188 notifications were queued
for the weekly digest (Mondays 17:00 UTC) — meaning that absent intervention, ~149 people
would have received the phishing text by email on the next digest run. Deleting the
comments cascades to `notifications` (`notifications_comment_id_fkey ... ON DELETE
CASCADE`), so the superban cleared that queue as a side effect.

Everyone else was exposed via in-app notifications and the public project pages.

## What worked

- **Comment rate limits (C9)** throttled the attack. `lib/comments/limits.ts` caps project
  comments at 30 per 5 minutes; the two multi-minute gaps in the timeline are the limiter
  firing. Without it, 82 comments would have taken ~7 minutes instead of 33.
- **The daily threshold alert fired.** Passing 60 project comments in a day triggers a
  Discord alert (`comment.daily_threshold`), which this account hit around comment 60.
- **User reporting (C20)** worked: 2 users filed reports.
- **Digest batching** accidentally contained the damage — 2 emails out instead of 151.

## What didn't

1. **Nothing blocks an account from naming itself `Manifund_Support`.** There is no
   reserved-username list and no protection on `manifund`/`support`/`admin`/`team`-style
   names, and no staff badge on comments that would let a reader distinguish a real
   Manifund account from this one. This is the root cause of the impersonation half of the
   attack.
2. **The spam filter does not look at comments.** `app/utils/spam-scores.ts` scores and
   auto-superbans on *project* creation (S19). This account created no projects, so the
   filter never ran. Comment spam has rate limits but no content classification.
3. **No link-safety check on comment content.** A userinfo-spoofed URL
   (`https://legit.com@evil.com/...`) is a well-known, mechanically detectable phishing
   pattern, and `checkContent` in `lib/comments/content.ts` — which validates the editor
   document's nodes and marks — did not look at link hrefs at all. 82 identical links to a
   shortener domain also went unremarked.
4. **Reports were queued, not escalated.** Two spam reports on a brand-new account posting
   identical content to dozens of threads did not stop it or page anyone; the attack ran
   to completion and was removed by manual admin action later.
5. **Rate limits are tuned for annoyance, not abuse.** 30 comments / 5 min and a *warning*
   (not a block) at 60/day let a single fresh account reach 82 threads. The comment on
   `limits.ts` says limits "should never trigger for normal users" — correct as written,
   but it means the ceiling sits well above what an attacker needs.

## Response taken

Superbanned `Manifund_Support` via `db/superban.ts` (admin client, cascading hard delete):
82 comments, the profile, and the auth user removed; 204 notifications cascaded away with
the comments. No projects, bids, or txns existed to delete. Evidence preserved in this
report before deletion, since superban is irreversible and destroys the record.

Verified in prod afterwards: 0 rows for the profile, 0 comments by it, 0 notifications
naming it as actor, 0 comments anywhere still containing the phishing link, and no
remaining profile with a `manifund`/`support` lookalike username.
`manifund.org/Manifund_Support` renders not-found, and spot-checked project comment tabs
no longer serve the link.

## Follow-ups

Not done; each is a separate change.

- [x] **Reserve staff-sounding usernames.** Done 2026-11-05 as account holds (people U2-U6): a name with
      "Manifund" or "Trust & Safety" is held outright, and Claude checks the rest for impersonation; a held
      account can't post until an admin clears it. A plain "support" or "admin" isn't held without the model. Block registration of names matching
      `manifund`, `support`, `admin`, `team`, `trust`, `safety`, `security`, `official`
      and close variants (including the display name, not just the slug).
- [x] **Detect userinfo-spoofed URLs in comment content** (`lib/comments/content.ts`):
      reject any link whose authority contains `@` before the host. Cheap, exact, no false
      positives on legitimate links. Done 2026-11-04 — rule C37.
      Still open: project descriptions and org pages are editor documents too and get no
      such check, so the same link would post fine inside a proposal.
- [ ] **Flag duplicate comment content across threads.** N identical comments on N
      different projects from one account inside a short window is a strong, simple spam
      signal; auto-hold pending review rather than relying on rate limits alone.
- [ ] **Escalate on reports against new accounts.** k spam reports (k=2?) against an
      account younger than ~24h with no funding history → auto-hide its comments and
      page an admin, instead of waiting in the queue.
- [x] **Extend spam scoring to comments** — done 2026-11-05 (comments C38-C42): every person's comment is
      checked after posting, and a flagged one is collapsed and queued, with its notifications held., or at minimum run new accounts' first comments
      through the same classifier that gates projects (S19).
- [ ] **Add a staff badge** on comments from real Manifund accounts, so "Manifund Support"
      with no badge reads as suspicious.
- [ ] **Consider notifying the ~154 exposed users.** The phishing text is now deleted from
      the site and the digest queue is cleared, but anyone who read the in-app
      notification or the project page before removal may have clicked. A short "we never
      ask you to verify bank details via a comment link" note would close the loop.
      Austin's call — it trades reassurance against drawing attention to the attack.
- [ ] **Characterize the landing page** (`share.google/dtG6j79TozcmklqIk`) from a
      sandboxed environment, and report the shortlink to Google if it is still live.

## Rules touched

No product rule changed. Relevant existing rules: C9 (comment rate limits), C20 (reports
queue), S16/S17 (superban), S19 (spam filter auto-ban). The follow-ups above would add
rules to `docs/product/comments/` and the accounts area.
