# People (profiles)

Stub. To be written the way `../comments/README.md` is: what profiles are for, how they're built, numbered rules
(`U1`…), decisions, open questions, tests.

Until then: the overview is in `../intent.md` ("People"); comments on profiles are covered in `../comments/`.

## Rules

- **U1** People edit their own profile (name, username, bio, website, avatar, About). Accreditation, regrantor
  status, account type (individual, org, fund) and payout accounts (Stripe Connect, Mercury) are set by the server
  only: admin tools, payout onboarding, the Supabase dashboard. A database trigger
  (`protect_profile_payment_columns`) keeps those columns unchanged when anyone else updates a profile. Profiles
  are created by the sign-up trigger, with these fields at their defaults. Tests: `tests/db/profile-payment-fields.test.ts`.

### The profile page

- **U7** `/<username>` is one column, narrower than the org and fund pages for reading: a header (avatar, name,
  @username, regrantor tag, karma, bio, website, and how much they've given), a sticky section bar, and the sections
  About, Projects, Comments (C30), Donations (pending offers first, then gifts; old certificate trades and
  investments under them) and Transactions (their USD txns, with names instead of ids). About holds their own
  words, their balance (public: total, split into charity, cash and pending, with the owner's deposit and withdraw
  actions), the donate box on a regrantor's profile (E15), and what they follow (F9). Each list shows 25 and a "Show
  more" that loads the next 25. A section with nothing in it is left out for visitors; the owner sees it with a
  prompt. Old `?tab=` links scroll to the matching section.
- **U8** The page shows the header as soon as the profile is read, and streams each section in as its data arrives.
  Visitors get public data cached for a minute; the owner always reads fresh. Balances and the lists read every
  txn and bid, past PostgREST's 1,000-row cap.

### Account holds

- **U2** A new account's username and display name are checked for impersonation (of Manifund, its staff, or the
  team members, whose names come from the admins' profiles) and for offensive names. A name with "Manifund" or
  "Trust & Safety" in it is held without asking the model; otherwise Claude (Sonnet, with Haiku as a fallback)
  decides. A role word like "admin" or "moderator" alone isn't impersonation; it is only when the name presents as
  Manifund's or the site's staff ("Site Admin", "Manifund Support"). If the check can't run, the account isn't held.
  Admins' accounts aren't checked.
- **U3** The check runs right after sign-up, again after a rename on the profile form, and again on the next post
  if the names changed since the last check (the profile is saved from the browser, so the post is where a rename is
  always caught).
- **U4** A held account can't post comments, create or publish projects, or give grants. The server refuses with a
  message, and the database refuses a held account's project writes from the browser too. The person sees the
  message in the sidebar. Browsing, editing the profile and donating still work.
- **U5** Admins are alerted on Discord and review held accounts at `/admin/held-accounts`: clear (the account can
  post; the same names aren't held again) or ban (superban: the account and everything it posted are deleted).
- **U6** The hold and its reason are visible to the person and admins only; nobody can lift their own hold.

| Date       | Decided by | Decision                                                                                                                                                                                           | Why                                                                                       |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2026-11-25 | Austin     | Profile redesigned like orgs and funds: sections with a section bar, 25 per list with "Show more", one column with balances and Following in About; balances and transactions stay public (U7, U8) | Match the modernized pages; load fast                                                     |
| 2026-11-05 | Carol      | Hold accounts whose names look like impersonation or are offensive until an admin reviews them; enforced from the start (U2-U6)                                                                    | The 2026-11-04 phishing account was named "Manifund_Support" and nothing stopped the name |
| 2026-11-23 | Caroline   | Don't hold names just for containing "admin", "moderator" or similar; only when they present as Manifund staff (U2)                                                                                | Ordinary handles like "sysadmin" were being held                                          |
