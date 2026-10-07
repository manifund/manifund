Create a Manifund page for a selection of ~25 top orgs in AI safety and other EA areas.

(Example orgs include METR, Longview, Humans First, Forethought, MATS, Lightcone, Epoch, 1DaySooner, AI Village, CAIS.)

## v0 goals:

- “Manifund DAF/every.org” — Give Manifund donors an affordance to donate to all relevant 501c3 charities, even if they don’t have a Manifund page
- “Wikipedia/Crunchbase” — Inform donors who want to know more about where to give
  - Collect past project proposals
  - Scrape info from their webpage & other sources and make a great unified source of info
  - Show data & visualizations for past donations (Trace), employees,
- “Yelp for charities” — give the community a place. to leave reviews
  - “Givewell” — Seed this with in-depth reviews, ourselves

### Tech notes

- New orgs table, with
  - uuid
  - metadata
    - name
    - logo
    - slug
    - official website
  - legal data:
    - official/legal name
    - type of org (501c3, 501c4, C-Corp, PBC)
    - us state of org, or country
  - summary information
    - 1-line summary
    - 1-paragraph about
  - other data (some from trace): funding data, employee info
  - <check what’s already in trace.manifund.org>
  - some way to track the Manifund projects that are associated with this org
- (i think there’s already a public.orgs table but I think that’s basically unused and we should kill it)

- org pages should exist on e.g. `manifund.org/orgs/metr`

## v1 goals:

- Allow charities to claim their own profile
- Commission/write great botecs on cost-effectiveness for the largest charities in the space
  - “why is CG giving these 5 charities >$50m each?”
  - Ask the charities themselves to list the grant applications they applied with to other places
- Make all this data available in our API/MCP
- Cover every relevant charity (eg every one tracked in Trace)
- Make it easy for new charities to create their own profile

## Data model notes by Opus 5.5 (2026-10-06)

Migration: `supabase/migrations/20261006000000_orgs.sql`.

- **What lives where.** `public.orgs` is what Manifund says about an org (page identity, summary and about, legal
  identity, donation link). `trace.*` is what public sources say (grants in and out, team, third-party reviews,
  former names). The org page reads Trace live from the same database; nothing is copied.
- **`public.orgs`**: `slug`, `name`, `logo_url`, `website`, `summary` (one line), `about` (Tiptap jsonb),
  `legal_name`, `legal_structure`, `ein`, `country`, `us_state`, `donation_url`, `trace_slug`. Readable by everyone,
  written only by the service role.
- **Fundraising is a project, not a profile.** An org raising through Manifund has one or more projects (e.g.
  "Lightcone general operations", or Lighthaven and LessWrong separately), whether or not anyone from the org has
  an account. `org_projects` links them, along with past proposals; the page offers donating to the ones open for
  funding. No org profiles are created. An org with no projects and no `donation_url` is still listed.
- **`org_projects` is a table, not `projects.org_id`**, because creators can update their own project row and must
  not be able to put a project on another org's page. One org per project for now.
- **One Trace entity per org**, linked by `trace_slug` with no foreign key (Trace merges and rebuilds its rows).
  Where Trace has several rows for one org, merge them in Trace (`data/aliases.json`, then `bun run seed`):
  Forethought has four, MATS two. CAIS's Action Fund is a separate entity and probably its own page. Unconfirmed
  whether Trace's "Lightcone Foundation" is the same org as Lightcone Infrastructure.
- **What Trace has today**: grants for all the example orgs except Humans First, team and headcount for 46 orgs,
  121 reviews (Zvi, Dickens). No descriptions, and logos are static files in the Trace repo, so `summary`, `about`
  and `logo_url` are ours to fill.

### Not in this migration

- Community reviews: add `org_id` as a third comment target (see `docs/product/comments/README.md`).
- Cause tags: `org_causes`, mirroring `project_causes`.
- Claiming a profile (v1): needs a membership table.
- Fiscal sponsorship: not modelled; an org with no entity of its own has null legal fields.
- Per-year 990 financials: belongs in Trace, which already has a 990 ingester.

### Open

- Org totals: check a simple sum of approved grants received against Trace's own logic (regranting vehicles,
  estimated amounts) before showing numbers that could disagree with trace.manifund.org.
- Trace types: try `gen-types --schema public,trace` for typed Trace queries.
- Several open projects on one org: no stored order for which to feature first.
- Seeding the ~25 orgs: a checked-in file plus an upsert script, keyed by slug.
