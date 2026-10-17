# Accounts and sign-in

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

How people get an account on Manifund, sign in (email and password, or Google), carry their session to Trace, and
how admins remove an account (bans). How it got here: `history.md`. What a profile shows and how people edit it:
`../people/`. Grants sent to someone's email before they had an account: `../ledger/` (L18-L20).

Written from the code on 2026-10-08 (backfill). The rules say what the product does today ("observed"); the intent
below is a draft for the team to confirm.

## What accounts are for (draft)

- **Acting on Manifund**: donating, offering, posting a project, commenting, regranting, withdrawing all need an
  account. Reading doesn't: projects, profiles, the ledger and comments are public.
- **One account across Manifund's sites**: Trace (trace.manifund.org) uses the same accounts, and people move from
  Manifund to Trace without signing in again.
- **Getting money to the right person**: a grant sent to an email is claimed when that address signs up, so the
  sign-up form reminds grant recipients which address to use.
- **Keeping spam out**: an admin, or the spam filter for brand-new accounts, can remove an account and everything it
  made.

## How it's built

- **Supabase Auth** holds the accounts (`auth.users`): email and password, and Google. Trace uses the same Supabase
  project, so it's the same account on both sites; only the session cookie is per site.
- **One form** (`components/auth/AuthModal.tsx`) with three modes: sign in, create an account, reset the password.
  It's the `/login` page and also shows in place of pages that need an account (`/edit-profile`,
  `/edit-profile/roles`, `/withdraw`, `/withdraw/request`, `/evals-form`). Its server actions are in
  `lib/auth-actions.ts`. It greets people "Welcome back" when this browser has signed in before (a `localStorage`
  flag).
- **Every link back from Supabase lands on `/auth/callback`** (`app/auth/callback/route.ts`): email confirmations,
  password resets and Google. It verifies the link, sets the session cookie and sends the person on to `next`.
  `utils/safe-next.ts` decides which `next` values are allowed. `components/oauth-code-handler.tsx` (in the root
  layout) tidies a leftover `?code=` from the address bar.
- **Sessions** are cookies, checked and refreshed on every request by `proxy.ts`.
- **A profile per account**: a database trigger on `auth.users` (`handle_new_user`, migration
  `20260617000000_signup_default_username_from_email.sql`) creates the `profiles` row as the account is created.
  A second trigger (a database webhook) calls `/api/transfer-project` to claim grants sent to the address (`../ledger/`).
- **`/sso`** (`app/sso/route.ts`) hands a session to Trace.
- **Bans** ("superban"): `db/superban.ts` deletes a person and what they made, step by step, with the service-role
  client. Two callers: the admin's Superban button on a profile (`app/[usernameSlug]/superban-dialog.tsx` ->
  `pages/api/superban-user.ts`) and the spam filter (`app/utils/spam-scores.ts`, `handleSpamProject`). The deletions
  rely on `on delete cascade` foreign keys added for it (migrations `20260128000000`, `20260417000000`,
  `20260417000001`).
- **Admins** are a list of email addresses in `db/profile.ts` (`isAdmin`); locally, the extra addresses in
  `NEXT_PUBLIC_LOCAL_ADMIN_EMAILS` too (development builds only).
- **Settings outside the repo**: production's Supabase Auth settings (whether an email must be confirmed before
  signing in, the minimum password length, allowed redirect URLs, the email templates) live in the Supabase
  dashboard. `supabase/config.toml` is the local stack's.

## Rules

Ids are stable once merged: tests name them, and a removed rule keeps its id in `history.md`. All rules here are
observed (code, 2026-10-08) unless marked otherwise.

### Signing in

- **S1** One form signs people in with their email and password, or with "Continue with Google". It's at `/login`,
  and pages that need an account show it in their place when nobody is signed in (`/edit-profile`, `/withdraw`, …);
  other pages link to `/login`. From it, people switch to creating an account or resetting their password.
- **S2** Password fields (signing in, creating an account, a new password) have a show/hide button; a shown password
  is hidden again when its form is submitted.
- **S3** After signing in, people land where they were going: the `next` of `/login?next=…`, carried through Google
  and through `/auth/callback`. Only a path on this site counts; anything else (another site, `//host`, `/\host`,
  nothing) lands on the home page. Pages that don't pass a `next` land on the home page.
- **S4** A failed sign-in shows the reason in the form, in Supabase's words (e.g. wrong password). A link that failed
  (expired, already used, malformed) brings the person to `/login` with the reason, under "Authentication Error"
  ("Email Link Expired" for an expired link).

### Creating an account

- **S5** Creating an account with an email and password: the form says "Account created! Check your email to
  continue signing up", and the email's link goes through `/auth/callback` to `/edit-profile`.
- **S6** "Continue with Google" creates the account the first time it's used.
- **S7** Every new account gets its profile at once. Its username is the email's part before the `@`, made fit for a
  URL (spaces become dashes, other characters than letters, digits, `_` and `-` are dropped), with a number added when
  it's taken (`ada`, `ada1`, `ada2`, …). Its name is the one from Google if there is one, else the email's part before
  the `@`. If either would be empty, the account's id is used. (The same rule from the profile's side:
  `../people/`, E2.)
- **S8** A new profile starts plain: an individual, no bio, not a regrantor, not accredited.
- **S9** Profiles are made only by creating an account, and nobody deletes their own: browsers, signed in or not,
  can't create or delete a profile. An account goes away only through a ban (S16).
- **S10** Someone sent a grant by email gets a link to `/login?email=<their address>`, and the form asks them to use
  that address (what happens when they do: `../ledger/`, L18).
- **S11** New accounts can be switched off in code (`DISABLE_NEW_SIGNUPS_AND_PROJECTS` in `utils/constants.ts`,
  together with new projects; used in January 2026 against spam accounts). While off, the sign-up form answers with
  a message saying so and giving hi@manifund.org. Today it's on.

### Passwords

- **S12** "Forgot your password?" emails a reset link. The link goes through `/auth/callback` to
  `/edit-profile/reset-password`, where the person types a new password twice (matching, at least 6 characters),
  and then lands on `/edit-profile`.
- **S13** Email links work wherever they're opened: links carrying a `token_hash` are verified without the browser
  that asked for them (a phone, another computer). Links carrying a `code` (Google, and emails built that way) work
  only in the browser that started. A link naming a kind other than sign-up, invite, magic link, recovery or email
  change is refused as malformed.
- **S14** People who signed up with email and password can change their password on `/edit-profile` (the same
  rules as S12); people who use Google don't see that form.

### Signing out

- **S15** People sign out from their own profile page; they land on the home page, with signed-in views dropped.

### Bans

- **S16** Only admins ban. A "Superban" button on someone else's profile opens a dialog listing what will go (their
  projects, by name, and the number of their comments) and asks for `BAN` to be typed. `/api/superban-user` refuses
  anyone who isn't an admin.
- **S17** A ban deletes the person and what they made, in this order: their projects (with the comments, follows
  and votes on them); their comments everywhere, with the replies to them (`../../product/comments/`, C18); their
  profile (with their votes, follows, reactions, reports, notifications and the comments on their profile); and
  their sign-in account, which frees the email for a new account. Trace keeps what they wrote there, without their
  name.
- **S19** The spam filter bans automatically: when it flags a project whose creator's account is less than 7 days
  old, it emails the creator and then bans them (S17). For older accounts, or when the account's age can't be read,
  it only hides the project. (The spam filter itself belongs with discovery, not documented yet.)

### Signing in to Trace

- **S20** `/sso?next=<Trace page>&then=<path>` hands a signed-in person's session to Trace: it redirects to the Trace
  page with the session in the URL's fragment (the part after `#`, which browsers never send to a server), and
  `then`, the Trace path to open afterwards (`/` by default).
- **S21** Only Trace: `next` must be `https://trace.manifund.org` or a page under it; anything else is refused (400).
- **S22** Signed out, `/sso` sends the person to `/login`, and once signed in (by email or Google) the handoff to
  Trace carries on (S3).

## Decisions

Found in the git history and pull requests (2026-10-08); the person is the author of the change, who isn't
necessarily who decided. Newest first.

| Date | Who (from git) | Decision | Why (from the PR or commit) |
|---|---|---|---|
| 2026-10-07 | Vals (#284) | Show/hide button on password fields, hidden again on submit (S2) | Seeing what you typed; not leaving a password on screen |
| 2026-08-28 | Caroline (#216) | Reset links go through `/auth/callback`, preferring `token_hash` links (S12, S13) | Reset never established a session; `code` links fail on another device |
| 2026-08-27 | Caroline (#214) | Sign-in returns to `next`, same-site paths only (S3, S22) | The handoff to Trace was lost after signing in; `next` comes from a URL anyone can write |
| 2026-08-26 | Caroline (#211) | `/sso` to Trace: tokens in the URL fragment, Trace as the only allowed target (S20, S21) | One sign-in for both sites; an open target would hand sessions to any site |
| 2026-07-21 | Caroline (#182) | Spam filter: ban accounts under a week old, hide the project otherwise, email first (S19) | New accounts posting spam are almost always throwaway; older ones may be a real person |
| 2026-06-17 | Austin | Usernames and names from the email (or Google) at sign-up (S7) | New profiles showed the account id as their name |
| 2026-01-28 | Austin | Superban (S16, S17), with cascading deletes; a switch to stop new accounts and projects (S11) | Spam accounts |
| 2025-05-30 | Nishu (#154) | One form for sign-in, sign-up and reset; password change for email accounts (S1, S12, S14) | Password resets didn't work before |

## Open questions

- **The grant recipient's reminder** (S10) shows on the sign-in view only (`components/auth/AuthModal.tsx:211`);
  switching to "Sign up", which is what a new recipient needs, hides it.
- **"Complete your profile" banner** (`components/complete-profile-banner.tsx`) shows when the username is the
  account id or the name is empty. Since S7 (June 2026) new accounts get both, so only older accounts can see it.
  Keep it?
- **`/confirm-signup`** (`app/confirm-signup/page.tsx`, 2023) shows a bare "confirmation link" built from its query
  string; nothing in the repo links to it. Is a production email template still pointing at it? If not, delete it.

## Later

- Account deletion by the person themselves (none today: S9).

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components) and `bun run test:ai-reference:routes` (routes,
against a dev server); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/accounts.test.ts`): where people land after signing in (S3), `/sso` refusing
  other sites (S21), the order of a ban's steps (S17), the spam filter's ban-or-hide choice (S19).
- **Components and server actions** (`tests/ai-reference/components/accounts.test.tsx`, with a stand-in Supabase
  client): the form (S1, S4, S10), the password field (S2), the links in sign-up, reset and Google emails (S3, S5,
  S12), the sign-up switch (S11).
- **Database** (`tests/ai-reference/db/accounts.test.ts`): the profile made at sign-up (S7, S8), no profiles created
  or deleted from browsers (S9), what a ban deletes (S17).
- **Not tested here**: Google itself (S6) needs Google; changing and resetting the password in the form and signing
  out (S12, S14, S15) need a browser.
- **Routes** (`tests/ai-reference/routes/accounts.test.ts`): email links at `/auth/callback`, including a reset link
  used without the browser that asked (S3, S13); bans by admins only, and an admin's ban of a throwaway person (S16,
  S17); `/sso` signed in and signed out (S20-S22). Redirects are read, never followed, so Trace isn't contacted.
