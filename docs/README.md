# Manifund docs

What Manifund is for, how it's built, and how we work on it. For setting up a dev environment, see the root
`README.md`; for coding conventions, `CLAUDE.md`.

## How we work

- **Agent-driven development.** Agents write most of the code. The devs' role is mostly knowing what is wanted,
  doing the design and the higher-level architecture decisions, the visual design details and product details, and
  approving agent suggestions within these constraints.
- **Product docs are the source of truth for what we want.** Each area of the product has a doc saying what it's for,
  how it behaves, and what we decided and why. They're written during development (in the branch) and cleaned up at
  the end: what's merged describes the product, without the traces of how we got there. A branch's docs are
  tentative; merged, they're true.
- **Every rule can be tested.** Behaviours in the product docs have ids (e.g. `C12`), and tests name the rules they
  check. If it isn't written down, it isn't a promise.
- **Simple to understand beats clever.** We optimise for how easy the architecture and its data are to understand
  and use, fewer chances for errors, and less interconnection. Similar tables where it's clear what is what are
  better than one shared table everything points to; repeating a migration across a few tables is fine.
- **Simple by default.** Start with the plain version (e.g. whole past versions of a comment rather than a diff);
  add options when people ask for them.
- **Public by default.** Grants, donations and the discussion around them are public. Being public is our main
  defence against gaming, and how track records (and trust in someone's taste) get built.
- **The server writes, the database guards.** Browsers read; writes go through server code that checks the rules.
  The database enforces what must hold whoever writes (one target per comment, one level of replies, history kept).
- **Change the database in small safe steps.** Add first (new tables, nullable columns, new functions), ship the code
  that uses it, remove old things later. Old code keeps working at every step.
- **Log what happens.** Structured log lines (`lib/log.ts`: one JSON line per event, with ids, never email addresses
  or comment text), and alerts for things that silently fail.

## Architecture and services

One Next.js app on Vercel, one Supabase project. More detail on what each part is for: `product/intent.md`.

| Part | What it does |
|---|---|
| **Next.js 16** (`app/`, `pages/api/`) | Pages are server components that read the database while rendering. API routes do the writes: newer ones in `app/api/` (Node runtime), older ones in `pages/api/` (mostly Edge) |
| **Supabase** | Postgres (the data and its rules), Auth (email and Google sign-in), Storage (avatars, images) |
| **SQL functions** | Money moves that must be all-or-nothing: activating a project (offers become donations), grants, rejections |
| **The ledger** | `txns` (every movement of money) and `bids` (offers not yet money). Balances are computed from them, never stored |
| **Crons** (`vercel.json`) | Closing proposals past their deadline, update reminders, weekly digest, idle-balance reminders, bank sync and payout nudges, scoring and embeddings, the notification emails backup |
| **Database webhooks** | A new offer triggers the project's activation check; a new sign-up claims grants sent to their email |
| **Stripe** | Card deposits (Checkout), instant US payouts (Connect) |
| **Mercury** | The bank: ACH and wire payouts, each approved by a person |
| **Postmark** | Email |
| **OpenRouter / OpenAI, Pangram** | Spam filter, quality score for projects, embeddings for search and similar projects; AI-text detection |
| **PostHog** | Product analytics and error tracking |
| **Public API and MCP server** | `app/api/v0` (projects, users, comments) and `app/api/mcp`, for anyone and their agents. Reference: `/docs` on the site |

## What's where

```
docs/
  README.md           this file
  product/
    intent.md         what Manifund offers and why (one doc for now)
    <area>/           one folder per product area, e.g. comments/
      README.md       what the area is for, how it behaves (numbered rules), decisions and why, open questions
      history.md      how it used to work and how it changed (optional reading)
  plans/              plans and briefings written for a piece of work (some predate this structure)
  postmortems/
```

Areas so far: `comments/` (full), `projects/` and `people/` (stubs).

## Writing product docs

- **Write for someone new** (a new dev, the team in six months, an agent): what it's for before how it works.
- **Rules get ids**, with a letter per area (`C` for comments) and a number that never changes meaning. A removed rule
  keeps its id, marked removed, in `history.md`.
- **Decisions are dated and say who**: the team, a dev, or an agent's proposal someone approved. Short "why" next to
  each; the long discussion stays in the PR.
- **Say what's not decided** in an "Open questions" section rather than leaving gaps.
- **Keep the main doc current, move the past to `history.md`**: when a rule changes, the area doc shows the new rule;
  the old one and why it changed go to history.

## Example dev workflow (with agents)

1. **Say what's wanted.** On a branch, a dev writes the wish in the area doc (or tells an agent, who writes it down
   with the dev's words and the date).
2. **Understand what exists.** An agent reads the code, the git history and the area doc, and describes how it works
   today, including intent found in code comments, UI copy and PRs.
3. **Design.** The agent proposes options with tradeoffs (data model, flows, copy), with mockups where useful; the
   dev decides. Decisions go in the area doc as they're made.
4. **Build.** The agent builds in small steps, checking each against the rules, and writes tests that name them. It
   stops to ask when it hits a product decision it shouldn't make alone.
5. **Clean up.** Before review, the area doc is rewritten to describe the result (not the journey); what changed from
   before goes to `history.md`.
6. **Review and merge.** The PR is reviewed as docs plus code together: do the docs say what we want, does the code do
   what the docs say, do the tests check it. Merged, the docs are true.
7. **Ship safely.** Additive database changes first, then the code, then removal of old things (see "How we work").

### One setup in practice (Val's, for the curious)

Most work happens locally, with Claude Code. The shape of it (the tooling lives outside this repo):

- **A workspace around the repo**: the clone of this repo, one git worktree per feature or experiment (each on its
  own branch and dev server port), the local-stack scripts, and private working notes.
- **A local stack close to production**: Supabase in Docker with production's real schema (a scrubbed dump plus this
  repo's migrations), and either a copy of production's data or demo data with made-up people. Payment, email and
  analytics keys are blank locally, and a **network guard** stops the dev servers from reaching anything but
  localhost (emails get a fake "sent", production images a placeholder), so nothing local can touch production.
  Every worktree shares the one local database, so experimental migrations there only add things.
- **A coordinator session plus one session per thread.** The coordinator launches threads (a feature, a design
  question), relays the dev's answers, and presents one thread at a time; threads can also run as sessions the dev
  talks to directly. Each thread keeps a **brief**: what was asked (the dev's words, dated), decisions, questions,
  shortcuts taken, a progress log. The brief is the handoff: any new session picks the thread up from it.
- **Checkpoints**: a thread first reports its understanding, options and questions (no big build), then builds and
  reports when there's something to try (a local URL, test logins, a short demo script), or when it hits a product
  decision. Agents start at low effort to clarify and ramp up once the task is clear.
- **Principles, rules, guidelines.** A few hard rules (never push or open PRs, never write to live systems, never
  commit credentials, without the dev's go on that action); guidelines are defaults an agent may depart from when
  it clearly serves the principles (reduce what the dev has to read, keep a good model of what they need, let them
  work in parallel).
- **Live systems**: reads are fine; before any write to production, Vercel or GitHub, the agent lists the planned
  commands (what each changes, how to undo it) and waits for an OK. A hook prompts on remote writes as a backstop,
  and each such command must say why it's needed and what it changes.
- **Docs as you go**: threads write the product docs in this folder during the work, and the dev reads them along
  the way, so there's no separate documentation pass at the end. Static HTML mockups illustrate design stages.

## What stays out of this repo

- Security findings and anything that would help misuse the site before it's fixed.
- Personal data, including in examples (use made-up people).
- Secrets and keys (they live in Vercel and Supabase).
