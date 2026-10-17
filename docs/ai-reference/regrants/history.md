# Regrants and verdicts: history

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Ignore it unless asked: then use or update it ([about this folder](../README.md)).

How regranting and verdicts got to where `README.md` describes them, from the git history and PRs (written
2026-10-08). Optional reading.

- **2023-04 (#31)**: regrantors create a project for their grantee directly. A grantee already on Manifund owns it
  at once; one who isn't gets an email, and a webhook moves the project to them when they sign up with that email.
  At first the grant was a txn straight away.
- **2023-06 (#37, #39, #41)**: admins approve or reject grants (a table on the admin page, a modal with a comment);
  a proposal activates once approved, signed and at its minimum, and its offers then become txns. Grants became
  offers, and regrantors could set a minimum and a goal to ask other donors for the rest.
- **2023-10**: the approval asks for the public benefit; grants to people abroad ask about location.
- **2024-04 (#137)**: regranting 2024. The previous year's unspent budgets were cleared with "return bank funds"
  txns; the form validates emails and asks about lobbying.
- **2024 (#140)**: EA Community Choice roles (`profile_roles`), each claimed role giving $100 to donate; later paused
  ("Pause fund distribution").
- **2026-06**: a fixed $10k offer button for one microgrants program.
- **2026-07 (#181)**: verdicts by some admins failed silently (two admin lists); one list now, errors reported.
- **2026-09-11**: the grant functions check who is calling (`security definer` with caller checks) instead of
  relying on the caller's row-level security.
- **2026-10-05 (#275)**: the routes moved to `app/api` (Node), and the `_v2` functions replaced the old ones: they
  no longer insert the rationale or the admin's note, which `lib/comments` posts afterwards. The old functions were
  dropped after deploy.
