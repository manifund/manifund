# Causes, rounds, funds and programs

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

How Manifund groups projects and money: cause areas people browse by, programs and prize rounds people apply to,
the rounds every project belongs to, and fund accounts people donate to. Project lists and the home feed (how causes
filter them) belong to discovery, documented separately; here only what causes and rounds are and what their pages
show.

Everything below is **observed (code, 2026-10-08)**: written by an agent from the code and its history, for the team
to confirm. Intent is marked as a draft where it appears.

## What they're for

- **Finding projects by topic.** Topic causes ("AI governance", "Technical AI safety", "Biosecurity"…) tag projects so
  people can browse a field (`/causes`, shown as "Categories" in the sidebar and bottom bar) and filter lists by it.
- **Running programs.** A program is a funding call with its own page and terms: past prize rounds and contests
  (ACX Mini-Grants, OP AI Worldviews, ChinaTalk, Manifold Community Fund, ACX Grants 2024, EA Community Choice) and
  current or recent calls (a microgrants program, grantmaking.ai, Falcon Fund). Creators apply by choosing the program
  when creating a project.
- **Collecting money for a fund.** A fund account (e.g. ACX Grants) takes donations from many people and passes them
  on; its page and a program's Donate tab are where people give to it.
- **Accounting by round.** Every project belongs to one round, which colours its tag and groups its stats; most
  projects are in "Regrants" (the default) or "Independent".

Draft intent (from the comments decision of 2026-10-05, Vals: "causes are keyed by slug, not id, and will be
reworked"): causes, rounds and funds overlap (a program is a cause *and* often a round *and* sometimes a fund) and
are expected to be reworked into a clearer model. This doc describes today's behaviour so the rework can keep what
matters.

## How it's built

- **`causes`** (keyed by `slug`): title, subtitle, header image, rich-text description, and flags: `prize` (a
  program rather than a topic), `open` (takes new projects), `sort`, `fund_id` (a profile that receives donations
  for the program), `cert_params` (impact-certificate settings for old prize rounds: `docs/ai-reference/dormant/`),
  `project_description_outline` (a program's template for the project description on the create form).
- **`project_causes`** links projects to causes (one row per project and cause). Written by the create, edit and
  publish routes and the regrant route through `updateProjectCauses` (`db/cause.ts`), which replaces a project's whole
  list.
- **`rounds`** (keyed by `title`): slug, dates (proposal due, auction close, evaluation), pool (`retro_pool`),
  header image, description. `projects.round` names a round by title.
- **Funds** are profiles with `type = 'fund'`; `/<username>` shows them with the fund page (`app/funds/[fundSlug]`).
- **Pages**: `/causes` (`app/causes/page.tsx`), `/causes/<slug>` (`app/causes/[causeSlug]`), `/rounds/<slug>`
  (`app/rounds/[roundSlug]`, stats in `components/round-data.tsx`), `/funds/<username>` (`app/funds/[fundSlug]`).
  Cause and round pages are cached for 60 seconds.
- **Editing**: admins edit a cause's or round's description and header image from the page (`edit-cause.tsx`,
  `edit-round.tsx`), writing directly to the database from the browser (images go to the `round-header-images`
  storage bucket). New causes and rounds are added in the database by hand; no flow creates them.
- **Hard-coded programs**: some behaviour names programs by slug or title in code: `LINK_ONLY_PRIZE_CAUSE_SLUGS`
  (`db/cause.ts`), the program terms in `pages/api/create-project.ts`, Falcon Fund's apply button and EA Community
  Choice's tabs (`cause-tabs.tsx`), the Regrants round's regrantor tab and stats, round colours (`getRoundTheme`,
  `utils/constants.ts`), a program's offer button (`../regrants/`, G17).

## Rules

Ids are stable once merged: tests name them.

### Causes

- **R1** A cause is either a **topic** (`prize` false) or a **program** (`prize` true), and is **open** (takes new
  projects) or closed. Everyone, signed in or not, can read causes, rounds, and which projects are in which cause.
- **R2** Causes and rounds are set up in the database by the team, not in the app: no flow adds or
  deletes one, and other people can't change them.
- **R3** `/causes` lists three groups: **Active programs** (open programs, outlined in orange; the group is left out
  when there are none), **Past prize rounds** (closed programs) and **Causes** (every topic, open or closed). Each
  card links to the cause's page and shows its image, title and number of projects, not counting hidden projects
  and drafts.

### A cause's page

- **R4** `/causes/<slug>` shows the cause's header image and title, then three numbers over its projects: proposals,
  active projects, and money raised (each project's amount raised: pending offers for a proposal, donations received
  otherwise). Hidden projects and drafts are left out of the whole page. An unknown slug is "not found".
- **R5** Its tabs: **Grants** (its grant projects; "Coming soon!" when there are none), **Impact certificates** (only
  when it has certificate projects), **About** (only when it has a description), **Donate** (only when it has a
  fund account: R11). EA Community Choice adds **Participants** and **Matching** (R13, R14). Falcon Fund's About tab
  starts with an "Apply for funding" button to `/create?prize=falcon-fund`.
- **R6** Admins see "Edit cause" on the About tab, to change the description and the header image; nobody else does.

### A project's causes

- **R7** A project can be in several causes; each cause at most once. A cause must exist to be chosen, and removing
  a project removes its links to causes.
- **R8** The create and edit forms let a creator pick at most 3 causes ("Maximum of 3 cause areas selected"; other
  causes are greyed out until one is unselected). The create form offers open topics; the edit form offers open
  causes (topics and open programs) and keeps every cause the project already has, even closed ones. The regrant
  form: G11.
- **R9** Programs are chosen on the create form, from a list of open programs (default: none, "grant"). Two of them
  are **link-only** (`LINK_ONLY_PRIZE_CAUSE_SLUGS`, e.g. grantmaking.ai): offered only when the page is opened with
  `/create?prize=<slug>`, and never addable by editing. `?prize=<slug>` preselects that program. The chosen program
  is saved with the project's causes. Creating or publishing a project checks the program on the server: it must be
  an open program, looked up by its slug, and its terms (certificate settings, starting liquidity) come from the
  database; a closed or unknown program is refused (400, "This program is not open"), which the form doesn't show
  yet (#316, 2026-10-16).
- **R10** Saving a project's causes replaces its whole list with the one sent; a cause sent twice is saved once.

### Rounds

- **R11** Every project is in exactly one round: the database refuses a round that doesn't exist. A new project is in
  "Regrants" unless its program says otherwise: EA Community Choice puts it in "EA Community Choice"; the
  link-only microgrants program (minimum $10,000), grantmaking.ai (minimum $5,000) and Falcon Fund (a normal grant proposal) put it in
  "Independent"; any other program makes it an impact certificate in the round named after the program
  (`docs/ai-reference/dormant/`).
- **R12** `/rounds/<slug>` shows the round's header image and title, its numbers, and tabs: **Projects** (the round's
  projects, without hidden projects and drafts), **Regrantors** (Regrants round only: every regrantor, ordered by
  the amount sponsored for them in 2023), **About** (the description, with "Edit round" for admins). Its numbers:
  for Regrants, regrantors and projects; for Independent, proposals, unfunded and active projects; for any round with
  a pool, the pool as "available funding". An unknown slug is "not found".

### Funds

- **R13** A fund is a profile of type `fund`: its address `/<username>` (and `/funds/<username>`) shows the fund page:
  its avatar as a header, "<name> fund", its bio, the donate box, the history of donations it received (with donors),
  and its long description. Visitors are invited to sign in to donate.
- **R14** The donate box (on a fund page, and on a program's Donate tab) offers three ways: by card (a deposit passed
  straight to the fund: `docs/ai-reference/deposits-withdrawals/`), from one's charity balance (a transfer to the fund:
  `docs/ai-reference/ledger/`; the button stays disabled with no amount or more than the balance), and by wire, ACH or
  DAF (instructions on an external page, recommended above $5k). The first two need a signed-in donor.
- **R15** A cause with a fund account (`fund_id`) gets the Donate tab: the fund's bio, the donate box, and the fund's
  donations history.

### EA Community Choice (2024)

- **R16** The Participants tab lists everyone who claimed Community Choice roles (G18), each with $100 per role, and
  shows the number of participants, the total claimed, and the $100,000 matching pool.
- **R17** The Matching tab projects the quadratic match: donations (USD transactions) and offers on the program's
  projects made from 2024-08-12 00:00 up to 2024-09-05 11:59:59.999 UTC count; one donor's amounts to one project are
  added up; each project's raw match is the square of the sum of the square roots of its donors' totals (rounded);
  the $100,000 pool is shared in proportion to raw matches. Rows are sorted by donated plus matched, after a total
  row; projects hidden since show as "Hidden project". The page says the amounts are projections.

## Decisions

From the code's history; none of these was written down as a decision at the time, so "who" is the author of the
change. Newest first.

| Date | By | Decision | Why |
|---|---|---|---|
| 2026-10-05 | Vals | Causes take no comments for now (C1, `docs/product/comments/`) | Causes are keyed by slug and will be reworked |
| 2026-09-29 | Caroline (PR #267) | Falcon Fund's About tab has an "Apply for funding" button (R5) | A direct way to apply |
| 2026-09-21 | Caroline (PRs #254, #255) | `/causes` shows open programs first, as "Active programs", without badges or section descriptions (R3) | Surface the programs taking applications |
| 2026-09-13 | Austin | The Matching tab only counts donations and offers inside the matching window, filtered in the query (R17) | Newer donations pushed eligible ones past the row limit |
| 2026-07-15 | Austin | grantmaking.ai is a link-only program, $5k-$50k grants (R9, R11) | Applications only through the program's own link |
| 2026-06-25 | Austin | A microgrants program is link-only; existing members keep it when editing (R8, R9) | Only invited applicants |
| 2026-02-07 | Austin | At most 3 causes per project (R8) | |
| 2024-03-13 | Rachel | Programs and topics are separated on `/causes`, renamed "Categories" in navigation (R3) | |
| 2024-02-09 | Rachel | The edit form offers only open causes (R8) | Closed causes shouldn't get new projects |
| 2023-12-14 | Rachel (PR #75) | Fund pages (R13, R14) | Donations to a fund rather than to a project |

## Open questions

1. **Edits by some admins fail (R6).** "Edit cause" and "Edit round" show to the app's admins (`db/profile.ts`,
   `ADMINS`), but the save writes from the browser and fails for some of them, with the error only in the browser
   console (`edit-cause.tsx:30-38`, `edit-round.tsx:30-38`). Draft intent: the app's admins edit, ideally through a
   server route.
2. **Round countdowns count the wrong way (R12).** `components/round-data.tsx:16-21` computes
   `differenceInDays(now, date)`, which is positive *after* the date, so the countdowns show for past dates: ACX
   Mini-Grants (2023) shows "1300 days to bid" and "1320 days to submit projects". Every round with dates is past, so
   the simplest fix may be to drop the countdowns. Not a rule until decided.
3. **The match projection (R17) counts offers that never became money, and may count some twice.** It reads every
   offer in the window whatever its status, so declined and withdrawn offers count, and an offer that became a
   donation in the window counts as both (`db/bid.ts` `getMatchBids`, `db/txn.ts` `getMatchTxns`). The round ended
   in 2024 and payouts were "at Manifund's discretion", so this may not matter now.
4. **`/funds/<username>` shows any profile as a fund** ("Alice Donor fund" for a person). And Falcon Fund's account
   is an individual profile, so `/falcon-fund` shows a person's profile, not the fund page. Should `/funds/` only show
   funds, and should Falcon Fund's account be a fund?
5. **Order on `/causes` (R3).** `listFullCauses` sorts by a `name` field causes don't have, so cards come in the
   database's order; the `sort` column is only used by the MCP server's `list_causes`. Sort by `sort`?
6. **Saving causes isn't all-or-nothing (R10).** `updateProjectCauses` deletes then inserts: if the insert fails, the
   project is left with no causes.
7. **Unused code** (to delete, per the repo's dead-code habit, once confirmed): the home page's "Active programs"
   section (`app/projects/causes-section.tsx`, `cause-preview.tsx`, `regranting-cause.tsx`, commented out in
   `app/projects/page.tsx`), the admin `AddTags` button (always disabled, not rendered anywhere), `getRounds` and
   `listMiniCauses` (`db/`), and the `project_causes.application_stage` column (always empty).
8. **Participants are shown $100 too much each (R16).** The roles object the tab gets includes the row's `id`
   (`db/profile.ts` `getProfilesWithRoles`), and `donors.tsx:6-8` counts every truthy value as a role, so each
   participant's budget and the total claimed include one extra $100. It doesn't list the id as a role. Display only
   (the round is over).

## Later

- The rework of causes (one model for topics, programs, rounds and funds, with ids), which also unblocks comments on
  programs (`docs/product/comments/`, Later).
- Program-specific behaviour out of code and into data (link-only, terms, apply buttons, extra tabs).

## Tests

Run locally: see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic**: R10 (replacing a project's causes).
- **Components**: R4 (the page's numbers), R8 (the 3-cause limit), R16 (participants), R17 (the match).
- **Database**: R1 (public reads), R2 (others can't change them), R7 (links), R11 (rounds exist).
- **Browser** (to write): R6 and what the create and edit forms offer (R8, R9): they render in the browser only.
