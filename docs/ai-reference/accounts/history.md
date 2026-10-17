# Accounts and sign-in: history

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Ignore it unless asked: then use or update it ([about this folder](../README.md)).

How sign-in got to where `README.md` describes, from the git history (2026-10-08). Optional reading.

- **2023**: sign-up confirmed by email, landing on a blank `/edit-profile` to fill in the profile; a
  `/confirm-signup` page showed the confirmation link (still in the repo, see Open questions). A new profile's
  username and name were the account id until edited, and a "Complete your profile" banner asked for them.
- **2024**: sign-in returns to the page people came from (#133, then reverts and fixes the same day).
- **2025-05** (#151, #154): `@supabase/ssr` instead of the old auth helpers; one form for sign-in, sign-up and
  password reset (`AuthModal`); a password change form for email accounts. Reset links went to `/edit-profile`, then a
  page that waited for a session, which in practice never arrived.
- **2026-01-28**: a spam wave. A switch to stop new accounts and projects (S11), and the admin's Superban (S16, S17),
  with cascading deletes added to the schema so it could go through.
- **2026-02**: Next.js 16; signing in no longer redirects on the server (the form navigates itself).
- **2026-06-17**: usernames and names from the email or Google at sign-up (S7).
- **2026-07-21** (#182): the spam filter, which bans new accounts that post spam (S19), sharing Superban's code.
- **2026-08** (#211, #214, #216): `/sso` to Trace; returning to `next` after sign-in, same-site only; password
  reset through `/auth/callback` with `token_hash` links, so it works on another device.
- **2026-09-11** (#243): `next` checked in the leftover-`?code=` handler too.
- **2026-10-07** (#284): show/hide button on password fields.
