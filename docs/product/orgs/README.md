# Orgs

Pages about organizations donors might give to (`/orgs/<slug>`), whether or not anyone from the org uses Manifund.
The plan and the data model's reasoning: `docs/plans/org-profiles-2026-10-06.md`.

## What org pages are for

- **Somewhere to give.** A donor can give to an org from the page: through its project on Manifund, or on the
  org's own site.
- **Something to read first.** What the org does, who funds it and how much, who works there.
- **What others think.** Reviews from the community, next to reviews published elsewhere.

## How it's built

- **`public.orgs`** is what Manifund says about an org: name, summary, about text, legal identity, links. Written
  by the service role only (by hand, or `bun scripts/seed-orgs.ts` from `scripts/orgs-seed.ts`).
- **`trace.*`** is what public sources say: grants, team, reviews published elsewhere. The page reads it live
  through `orgs.trace_slug`; nothing is copied.
- **`org_projects`** links an org to its Manifund projects.
- **Reviews are comments** with the org as their target (`comments.org_id`), so posting, editing, moderation,
  reports and reactions are the comment rules (`docs/product/comments/README.md`).
- **One long page** with a bar that jumps between its sections, and a right rail (donate, facts) that joins the
  column on narrow screens.

## Rules

- **O1** Everyone can read every org page; a slug with no org is a 404.
- **O2** Donating to an org is donating to its project that is open for funding (a proposal or an active
  project): an offer for a proposal, a donation for an active one, from the donor's balance. With several open
  projects, the oldest is offered. With none, the page links to the org's own donation page if it has one, and
  otherwise offers nothing.
- **O3** A section shows only when there's something in it: funding needs grants in Trace, proposals need a linked
  project, team needs people in Trace. Hidden and draft projects are never listed.
- **O4** Funding totals are a plain sum of the grants Trace has for the org (as on the org's Trace page), all time.
  The chart covers the last ten years with a grant; the four largest funders are named and the rest share one
  series. Trace's rows for unnamed money ("Unknown Donors") count in totals but are never a named funder.
- **O5** Anyone signed in can review an org or reply to a review; reviews are plain comments. Nobody is notified of
  a new review (an org page has no owner yet); replies and mentions notify as usual.
- **O6** Every review counts as five stars, the ones published elsewhere included: ratings aren't stored yet, and
  the stars, the average and the distribution are a placeholder for where they'll go.
- **O7** Reviews published elsewhere (from Trace) sit in the same list as the community's, newest first, with
  their author, where they were published, a "Published elsewhere" badge and a link to the original; their first
  three lines show, the rest on click.
- **O8** Reviewers who donated to any of the org's projects are tagged with what they gave.
- **O9** The list filters by who wrote the review: donors (reviewers who gave), staff, peers (reviews published
  elsewhere). Nothing says yet who is staff, so that filter is empty.

## Decisions

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-07 | Austin | Donations go through a project: one general fundraiser project per org we handle donations for (O2) | No new way for money to move; orgs need no account |
| 2026-10-07 | Austin | Reviews laid out as in the mockup (stars, distribution, filters), every review counted as five stars for now; ratings come to the schema later (O6, O9) | See the design with real reviews before deciding how ratings work |
| 2026-10-07 | Austin | Org pages keep the site sidebar; the main column is wider, into the space beside the sidebar, to fit the right rail | Stay inside the app |
| 2026-10-07 | Austin | Founded year, city and sources are columns on `orgs`; no cause tags yet | |
| 2026-10-07 | Austin | "Suggest an edit" and "Claim this page" email the team | Claiming is a later feature |

## Open questions

- **Ratings**: stored per review? Who may rate (donors, staff, peers), and is a rating required?
- **Manifund's own in-depth reviews** (scorecard, case for and against): designed, not built; nowhere to store
  them yet.
- **Which project is featured** when an org has several open ones (O2 picks the oldest).
- **The unnamed-money estimate** can dominate an org's total (most of METR's); whether to show it apart.

## Later

- Cause tags and browsing orgs by cause; filters on reviews (donors, staff, peers).
- Orgs claiming their page; orgs sharing applications they sent elsewhere.
- `/orgs` is a plain list for now, and isn't linked from the sidebar.

## Tests

- **Logic**: O4 (`tests/unit/org-funding.test.ts`). The rest has no tests yet.
