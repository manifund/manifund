# Karma

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Ignore it unless asked: then use or update it ([about this folder](../README.md)).

A reputation score for every person and project, built from money given and received, votes, comments and
reactions. It orders the homepage and is shown on profiles, project cards and project pages.

Shipped with #286 (2026-10-09). Everything below is **observed (code, 2026-10-09)**: written by an agent from the code,
the PR and the team's preview page ("Karma preview: leaderboard and homepage order", 2026-10-08, which may be out of
date), for the team to confirm. Where the preview page and the code differ, the code is the rule: the page records
the first intentions, and later choices (e.g. smooth vote weights) replaced them.

## What it's for

From `/about/karma` and the preview page:

- **A rough signal of contribution and trust**: "whether you've made valuable contributions to Manifund and its
  community, or are trusted by people who have". Money counts (given and received), and so do votes, comments and
  reactions, weighted by how much karma the person behind them has.
- **The homepage order.** Karma decayed by age replaces the old "hot" score (net votes, comments and money), so a
  project rises when people with karma vote, comment or give, and sinks over time otherwise.
- **Resistant to throwaway accounts.** A vote or reaction from someone with no karma carries no weight; a first
  deposit gives an account enough karma for its votes to count a little.

## How it's built

- **The formula lives in code**, `utils/karma.ts` (`KARMA_CONFIG` holds every constant, `computeKarma` the
  calculation). The database only stores its latest output: `karma`, `karma_breakdown` (the parts, shown on hover)
  and `karma_updated_at` on `profiles` and `projects` (migration `20261008000000_add_karma.sql`).
- **Recompute**: `recomputeKarma` (`db/karma.ts`) reads every profile, project, vote, comment, reaction, pending or
  accepted offer and USD transaction, computes everyone's karma together, and writes every row through the database
  function `apply_karma`. It runs hourly from Vercel's cron (`/api/karma/sync`, at :30) and from the admin page
  (`/api/karma/recompute`). `scripts/recompute-karma.ts` and `scripts/karma-preview.ts` run it from a terminal
  against whatever database the environment points to.
- **Between recomputes**: a vote moves the numbers at once (`adjust_karma`, migration
  `20261008010000_adjust_karma.sql`), and a new project gets its starting karma when it's created
  (`pages/api/create-project.ts`). The next recompute rewrites every row, so any drift from these shortcuts is
  corrected within the hour.
- **Ranking**: `projectHotScore` (`utils/karma.ts`) for the homepage, used by the server's cached top 20
  (`db/project-hot.ts`, `getHotProjectsCached`) and by the full list's "hot" sort in the browser
  (`components/projects-display.tsx`, `karmaHotScore` in `utils/sort.ts`). `/maxi` and `/mini` use the same order.
- **Display**: `components/karma.tsx` (the number with a star and a hover card), used by project cards, the project
  page and profile headers. `/about/karma` explains the formula with numbers read from `KARMA_CONFIG`; `/admin/karma`
  lists the top 100 people and projects.

## Rules

Ids are stable once merged: tests name them.

### What karma is made of

- **K1** Every profile and every project that isn't hidden or a draft has a karma score; hidden projects and drafts
  get none and count for nothing. The score is stored with its parts and the time it was computed.
- **K2** A person's karma is the sum of:
  - **starting karma**: 10 for anyone who has ever received a deposit (`deposit` or `mana deposit` transaction);
  - **donations given**: for each project they gave to, 2.5 × (their total to it)^0.3, worth 1.5× for the share
    committed before the project reached its minimum funding;
  - **donations received**: the same 2.5 × (total)^0.3 for each donor's total to each of their projects (no early
    bonus);
  - **votes on their projects**: each vote's direction (+1 or −1) × the voter's weight (K4);
  - **reactions to their comments**: each positive reaction (➕ 🥳 💡 🔥 👏 🌈) × the reactor's weight × 2; a
    tipped reaction counts ×2 (🧡), ×3 (🏅) or ×5 (🏆) on top.
- **K3** What counts as a donation: an offer on a proposal that is still pending (all of it early), and a USD
  "project donation" transaction to a project past the proposal stage, whose early share is what the donor had
  offered and was accepted at activation. Money from the bank account, to oneself, or to one's own project doesn't
  count.
- **K4** A person's weight is log10 of their karma, and 0 for karma of 1 or less: 10 karma weighs 1, 100 weighs 2,
  1,000 weighs 3. Because weights depend on karma and karma on weighted votes, everyone's karma is computed together,
  repeated (at most 10 rounds) until no score moves by more than 0.01.
- **K5** Nothing counts for oneself: votes on one's own projects, comments on one's own projects, reactions to
  one's own comments. Negative or neutral reactions (anything not in K2's lists) count for nothing.
- **K6** A project's karma is the sum of a base of 2, a creator term of 5 × log10(1 + the creator's karma), its
  votes (direction × the voter's weight), its comments by others (each the commenter's weight), and its donations
  (2.5 × (each donor's total)^0.3). A new project starts with the base and the creator term as soon as it's created.

### When it changes

- **K7** Karma is recomputed for everyone every hour, by the scheduled job, which only runs with the server's cron
  secret (without it configured, it refuses every call). Admins can also recompute from `/admin/karma`; anyone else
  is refused. A recompute rewrites every profile and project and refreshes the homepage's cached order.
- **K8** A vote moves karma at once: changing one's vote adds (new direction − old direction) × the voter's weight
  to the project's karma and to its creator's. A creator's vote on their own project, or a vote from someone with
  no weight, changes nothing. The project page shows the change (karma and the net vote count) before the server
  answers.
- **K9** Karma and scores are written by the server (the recompute and the karma functions). Visitors and signed-in
  people can't call the functions that write karma, and changing one's own profile or project leaves its karma,
  parts, time and scores as they were.

### Where it shows

- **K10** The homepage's default "hot" order is karma ÷ (age in days + 1)^1.7, with projects no longer taking
  donations (finished or not funded, or a grant that has reached its goal) counted at 0.2× in this order only. Ties
  go to the newer project. The first list the homepage shows (the top 20) leaves out hidden projects, drafts and
  projects that are likely AI-written and have raised $100 or less.
- **K11** People can sort project lists by karma (highest first), next to hot (the default), newest, closing soon
  and funding.
- **K12** Karma shows as a rounded number with a star: on project cards (which no longer show a vote count), on the
  project page left of the title (the vote arrows, with the net vote count between them, sit on the right), and on
  profiles. Hovering shows its parts and links to `/about/karma`; before the first recompute it says karma hasn't
  been computed yet.
- **K13** `/about/karma` explains the formula with the numbers the code uses, and is linked from the sidebar's
  About menu. `/admin/karma` (admins only; a 404 for everyone else) lists the 100 people and projects with the most
  karma, their parts, when karma was last computed, and the recompute button.

## Decisions

From the PR (#286) and the preview page; who decided what inside the team isn't recorded there.

| Date       | By                      | Decision                                                                                                                                                                                 | Why                                                                                           |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 2026-10-09 | Caroline (PR #286)      | Karma replaces the old hot score on the homepage (K10) and is shown on cards, project pages and profiles (K12); cards drop the vote count                                                | One signal for quality and trust, harder to game than raw votes                               |
| 2026-10-09 | Caroline (PR #286)      | Votes move karma at once, and the hourly recompute corrects drift (K7, K8)                                                                                                               | The number should react to a vote without waiting an hour                                     |
| 2026-10-09 | Caroline (PR #286)      | 10 starting karma for depositors; donations at 2.5 × total^0.3; weights log10(karma) (K2, K4)                                                                                            | A depositor's first vote counts a little, throwaway accounts not at all; big gifts count less |
| 2026-10-09 | Vals (backfill review)  | Where the preview page and the code differ (donation formula, vote weights), the code is the intent: the page was the first plan, and the team chose a smooth weight function afterwards | The page predates later choices made in a meeting                                             |
| 2026-10-08 | Caroline (preview page) | No regrantor bonus; reactions ×2; projects start at 2 karma; homepage age exponent 1.7, closed projects ×0.2 (K2, K6, K10)                                                               | New projects get a short run near the top before age buries them                              |

## Open questions

1. **Two definitions of "taking donations" in the hot order (K10).** The server's top 20 uses the value stored at
   the last recompute; the full list's hot sort recomputes it in the browser from current offers and transactions.
   A project that just reached its goal can rank differently in the two, and the order can shift when the full
   list replaces the first one. Use one?
2. **Votes on hidden projects and drafts move karma (K8)** until the next recompute, which ignores them (K1). Harmless
   (corrected within the hour), but the creator's karma moves for a vote on a draft in between.
3. **The MCP server ranks by another score**: see `../api/README.md`, open question "Score vs karma".
4. **Dead code**: the old `hotScore` (`utils/sort.ts`) is no longer used anywhere since #286. Remove it?

## Later

- If karma is meant to stay explainable, a history of recomputes (when the formula changes, scores jump for
  everyone; `karma_updated_at` only keeps the last one).

## Tests

Run locally: `bun run test:ai-reference` (unit, database, components) and `bun run test:ai-reference:routes` (routes,
against a dev server); see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/karma.test.ts`): K1-K6 (the formula on small made-up inputs), K10 (the hot order).
- **Components** (`tests/ai-reference/components/karma.test.tsx`): K11 (the karma sort), K12 (the number, cards).
- **Database** (`tests/ai-reference/db/karma.test.ts`): K1 (the stored columns), K7 (writing every row), K8 (the nudge
  function), K9 (who can write).
- **Routes** (`tests/ai-reference/routes/karma.test.ts`): K6 (a new project's starting karma), K7 (the scheduled job
  and the admin recompute refuse others), K8 (a vote moves karma), K12 (the project page: the number right before
  the title heading in the rendered body), K13 (the pages; the sidebar link is checked in the menu items the server
  sends, since the About menu renders its links only once opened).
