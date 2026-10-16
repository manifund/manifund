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
