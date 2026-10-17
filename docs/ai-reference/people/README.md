# People (profiles)

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

Who is on Manifund and what their public record says: profiles, editing your own, the people list, regrantor and
accredited-investor status, the donations leaderboard and charity accounts.

Backfilled 2026-10-08 from the code and its history: the rules say what the product does today ("observed"), not
what anyone decided it should do, unless a decision is cited. The product doc for this area,
`docs/product/people/README.md`, is still a stub. Neighbouring areas: following people and saved searches are
`../../product/follows/` (F), balances shown on a profile are the ledger's rules (`../ledger/`, L), comments on and
by a person are `../../product/comments/` (C30), Community Choice roles
are `../regrants/` (G18, G19), Stripe and Mercury ids on a profile are `../deposits-withdrawals/` (W), sign-in,
passwords and bans are `../accounts/` (S), the public API and MCP's user tools are `../api/` (I), fund accounts are
`../causes/` (R), and org pages (`/orgs`) are `../../product/orgs/` (O).

## What profiles are for (draft, for the team to confirm)

- **A public record.** A person's projects, what they gave and granted, what they wrote and what others wrote about
  them: what others use to decide whether to fund them or follow their lead (`../../product/intent.md`, "People").
- **Finding people.** `/people` lists everyone with a complete profile, regrantors first.
- **Trust signals the team sets.** Regrantors (who give grants from a budget) are marked everywhere they appear.

## How it's built

- **`profiles`**, one row per account, keyed by the auth user's id: `username` (unique, the profile's address
  `/<username>`), `full_name`, `bio`, `website`, `long_description` (the editor's JSON, "About Me"), `avatar_url`,
  `type` (`individual`, `org` for charity accounts, `fund`, `amm` for the dormant market maker), `regranter_status`,
  `accreditation_status` and `created_at`.
- **Created by the database at sign-up** (`handle_new_user`, a trigger on `auth.users`, since 2026-06-17), with a
  username and name made from the email or the Google name (E2). Accounts nobody signs in to (charities, funds)
  are made by hand.
- **Edited by the person** on `/edit-profile` (E4, E6). Avatars go to the public `avatars` storage bucket, one
  folder per person (E5).
- **Status set by the team.** Regrantor status is set by the team in the database; accreditation is a toggle on
  `/admin/users` (`/api/verify-investor`, admins only). Accreditation, regrantor status, account type and payout
  accounts are set by the server only: that rule is in the product doc, `../../product/people/README.md` (U1, #310).
- **Pages:** `/<username>` (`app/[usernameSlug]/`), `/edit-profile`, `/people`, `/people/id/<id>` (the stable link
  mentions use), `/leaderboards`, `/charity` and `/charity/<username>`. Reading helpers in `db/profile.ts`
  (`isAdmin`, the admin email list, also lives there).
- **Community Choice roles** (`profile_roles`, `/edit-profile/roles`, `/api/submit-role`): the 2024 programme that
  gave people money to donate per role they held. Paused; its rules are G18 and G19. The roles show on the
  Community Choice cause's donors tab.

## Rules

Ids are stable once merged: tests name them. All observed (code,
2026-10-08) unless a decision is cited.

### Profiles

- **E1** Every profile is public: anyone, signed in or not, can read every profile.
- **E2** Signing up creates the profile. Its username is the email's local part with spaces turned into dashes and
  everything but letters, digits, `_` and `-` dropped, with a number added (1, 2, …) when that's taken; its name is
  the Google account's full name, else the email's local part. Either falls back to the account id when empty
  (Austin, 2026-06-17, "Better defaults for usernames").
- **E3** Usernames are unique (exactly as typed: `Ann` and `ann` are two usernames). Saving a taken one on
  `/edit-profile` says it's taken and changes nothing (Caroline, #245, 2026-09-14).
- **E4** Visitors and other signed-in people can't change someone else's profile, and nobody adds or deletes a
  profile from the browser (a profile in the ledger can't be deleted at all, L4).
- **E5** Avatars are public; a signed-in person uploads avatars only into their own folder.

### Editing your profile

- **E6** `/edit-profile` edits the signed-in person's own profile: username, full name, short bio, website, "More
  about you" (rich text) and an avatar (PNG or JPEG). A visitor gets the sign-in box instead. (People who sign in
  with a password also change it here: S.)
- **E7** Username and full name are required; a regrantor also needs a short bio and an avatar, since they show in
  their profile preview. Until then Save is disabled and the form says what's missing. Regrantors see advice to add a
  website and background in "More about you".
- **E8** The username is saved with spaces turned into dashes and everything but letters, digits, `_` and `-`
  dropped.
- **E9** After saving, the person lands on their profile at its new address (or on the page that sent them, with
  `redirectTo`). A save that fails shows the error, and the form keeps what was typed (#245).
- **E10** A signed-in person whose username is still their account id or who has no full name sees a "Complete your
  profile" banner on every page, linking to `/edit-profile`.

### The profile page

- **E11** `/<username>` shows a person's profile; an unknown username is a 404. A fund's account shows its fund page
  (R); other kinds of account (charities, the market maker) show "Profile type not supported".
- **E12** A profile shows the name, `@username`, bio, website (a link, with `https://` added when it doesn't start
  with `http`), "About Me" (two lines, expandable), balances (L5-L12), projects, donations, investments, pending
  offers, comments (C30) and the person's USD transactions, newest first.
- **E13** Hidden and draft projects show on a profile only to its owner; so does an empty "Projects" section.
- **E14** A person's email address shows only on their own profile (Lily, #117, 2024-03-21).
- **E15** On their own profile, a person gets a link to edit it and a sign-out button. On a regrantor's profile,
  everyone else gets a donate box, to give to the regrantor's budget from their charity balance (L13).
- **E16** Whether someone is an accredited investor isn't shown on profiles or on `/people` (Austin, 2026-09-04).
- **E17** `/people/id/<id>` sends to the person's profile under their current username, or to `/people` for an
  unknown id. Mentions link there, so they survive renames (C32).

### Regrantors

- **E18** Regrantors (`regranter_status`) get a "regrantor" tag on their profile and on `/people`, and on the org
  reviews they write.
- **E19** Elsewhere (next to names on comments, project cards and lists), the badges come from lists of usernames in
  the code (`components/user-link.tsx`), not from the profile: a "Regrantor" badge for the 2025 sponsored regrantors
  and an "I work on Manifund!" badge for the team (`Austin`, `carol`).
- **E20** A signed-in regrantor sees a project creator's email address on the project's page (a "copy" button);
  nobody else does, admins included (Rachel, 2023-07-09, "show creator emails to regrantors").

### The people list

- **E21** `/people` lists individuals whose profile is complete (a username other than their id, and a full name);
  charities, funds and the market maker aren't listed (#58, 2023-08-09).
- **E22** Order: regrantors first (largest 2025 sponsored budget first), then people with a project, then people
  with a bio, then accredited investors, then everyone else (Austin, 2025-04-17, "Sort by 2025").
- **E23** Each row shows the avatar, name, bio, a regrantor tag and a creator tag (anyone with a project, whatever its
  stage), and links to the profile.
- **E24** Search keeps people whose name, bio or one project title contains every word of the query (any case).
  Rows load 50 at a time, more on scrolling.

### Accredited investors

- **E25** Admins set or clear someone's accreditation on `/admin/users` (`/api/verify-investor`, which refuses
  anyone else). It orders `/people` (E22).

### Leaderboard

- **E26** `/leaderboards` is public. "Total donated": per person, the sum of the USD deposits they received
  (money put into Manifund), highest first, leaving out regrantors and accounts without a profile. "All deposits":
  every USD deposit, newest first, with its date, amount and recipient. No email addresses (Austin, 2023-12-24,
  "List top donators").

### Charity accounts

- **E27** `/charity` lists charity accounts (profiles of type `org`). `/charity/<username>` shows the account's
  name, website and bio, what it has raised (the sum of every txn to it), its number of supporters (distinct
  senders), its donation history, and a donate box from the visitor's charity balance; an unknown username shows
  "Charity not found."

## Decisions

From the git history and PR descriptions, dated by commit; none reviewed for this doc yet.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-09-28 | Vals (comments work) | `/people/id/<id>` redirect; mentions link by id (E17) | 31 of 1,353 mentions pointed to old usernames |
| 2026-09-14 | Caroline (#245) | A failed profile save shows the error; a taken username gets its own message (E3, E9) | The Save spinner hung forever |
| 2026-09-04 | Austin | No accredited-investor tag on profiles or `/people` (E16) | Not given in the commit |
| 2026-06-17 | Austin | Default username and name from the email or Google name, made in the database (E2) | Better defaults than the account id |
| 2025-04-17 | Austin | `/people` orders regrantors by their 2025 budget (E22) | New regranting year |
| 2024-03-21 | Lily (#117) | Show your own email on your profile (E14) | Not given |
| 2023-12-24 | Austin | `/leaderboards` lists top donors by deposits (E26) | Not given |
| 2023-08-09 | Rachel (#58) | `/people`: searchable, everyone with a complete profile; profiles without tabs, comments at the bottom (E21, E24) | Not given |
| 2023-07-09 | Rachel | Regrantors see project creators' emails (E20) | Presumably so regrantors can reach grantees; not given |
| 2023-03-06 | Austin | Admins verify accredited investors on `/admin` (E25) | Not given |

## Open questions

Suspected bugs and unclear intent, found while backfilling (2026-10-08).

- **The edit form's "new user" path never runs.** `app/edit-profile/edit-profile-form.tsx:24-26` starts the username
  field empty when the username is still the id, so `isNewUser` (`:39`, username field equal to the id) is never
  true, and the blocks that fill the name from Google or the email and save in the background (`:46-71`) are dead. Since
  2026-06-17 the database does this at sign-up (E2) anyway. Delete it?
- **Usernames that are page names.** Nothing stops a username like `people`, `about` or `leaderboards`; such a
  profile is unreachable at `/<username>` (the page wins), and mentions of it land on that page. Reserve them?
- **Transactions on a profile name the other party by id** (`<uuid>`) unless it's Manifund Bank or the person
  (`app/[usernameSlug]/profile-content.tsx:142-151`, with a TODO). Show names?
- **The leaderboard's caption** says "Excludes regrantors and some large donations", but only regrantors are left
  out (`app/leaderboards/page.tsx:58`); and its "donated" totals include deposits that weren't donations (e.g. the
  Community Choice credits of 2024, recorded as deposits from the bank). Is the page still wanted? It's linked only
  from the sitemap.
- **`/charity/<username>` works for any account**, not only charities: an individual's username shows a charity page
  with a donate box. Intended?
- **Two sources for "regrantor".** The tag (E18) follows `regranter_status`; the badge next to names (E19) follows
  a list of 2025 usernames, so 2026 regrantors get no badge there. One source (the profile, or the programme's list
  of ids in `utils/constants.ts`)?
- **A website starting with `http` but not `http://`** (e.g. `httpbin.org`) is linked as a relative address
  (`utils/formatting.ts:116`).

## Later

- Agents' profiles (comments' "Later": profiles would need to say who is an agent).
- Where regrantor status is set (now by hand in the database) and how budgets arrive: see the regrants doc.

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components) and `bun run test:ai-reference:routes` (routes,
against a dev server); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/people.test.ts`): E12 (website links), E24 (search).
- **Components** (`tests/ai-reference/components/people.test.tsx`): E12, E14-E16, E18 (profile header); E16, E18, E21-E24 (the
  people list); E19 (badges).
- **Database** (`tests/ai-reference/db/people.test.ts`): E1-E5.
- **Routes** (`tests/ai-reference/routes/people.test.ts`): E6, E9-E11, E13-E15, E17, E20, E25-E27. The leaderboard test
  (E26) loads the whole page, about 20 s on a large database. E7 and E8 are `test.todo`: they're the form's own
  checks in the browser (a browser test would cover them).
