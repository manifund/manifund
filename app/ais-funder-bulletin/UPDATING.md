# Updating the AIS Funder Bulletin

This doc is for anyone (human or AI agent) refreshing the funder bulletin at
https://manifund.org/ais-funder-bulletin. All content lives in one file:
`app/ais-funder-bulletin/page.tsx`. There is no database or CMS — edit the
file, open a PR, and merging deploys it.

## File map

- `LAST_UPDATED` (near the top) — display string like `'July 28, 2026'`.
  Bump it whenever you change any content.
- `AT_A_GLANCE: Row[]` — the summary table. Each row: `name`, `href`,
  `donated2025`, `grants2025`, `expected2026` (each a `Cell`), `fte`, and
  booleans `generalApps` / `openRfps` / `donations`. Keep rows sorted by
  `expected2026`, largest first; re-sort if a figure changes.
- `NOTES` — the footnotes, rendered as an ordered list in the "Notes" section.
  Number them in order of first appearance in the table; renumber after a re-sort.
- `<Funder title="...">` sections — one collapsible profile per funder, each
  with the same nested-list structure: Website / Background / Thesis /
  By the numbers / Recent updates / Get involved.
- "Not included" section — funders deliberately excluded, with rationale.
- "Other resources" — external links.

## Gotchas

- **Footnote coupling:** a `Cell` is `{ v: string; n?: number }` where `n` is a
  **1-based index into `NOTES`** (rendered as `NOTES[n - 1]`). If you insert or
  remove a note, every later `n` in `AT_A_GLANCE` shifts — renumber them.
- **Duplicated note text:** each `NOTES` entry has both a JSX `node` (rendered
  in the Notes section) and a plain-text `text` (the hover tooltip on the
  superscript marker). Keep the two in sync when editing a note.
- **Conventions:** dollar figures are short strings like `'$400M'` / `'$1B'`;
  unknown values are `'—'`; always state years explicitly in prose (e.g.
  "in 2025", not "last year").

## Research process

Be thorough. The expectation is that **every figure and claim on
the page gets re-verified on every refresh**, not just skimmed for obvious
staleness. A refresh that only tweaks a line or two is almost certainly
under-researched. Do several distinct searches per funder (their site, public grants
database, blog/newsroom, careers page, plus news and community sources like
the EA Forum and LessWrong).

For each funder:

- **Confirm it still exists in its current form.** Check for renames,
  mergers, shutdowns, and successor funds. If a funder has been replaced,
  update everything — At-a-glance row, profile section, footnotes — to
  reflect the successor, and note the transition in the profile.
- **Re-verify every "By the numbers" figure and At-a-glance cell**, including
  current-year grant counts and totals from public grants databases. Add
  current-year figures where they exist (e.g. "N grants so far in 2026"),
  and update footnotes to match what the source now shows.
- **Keep At-a-glance booleans (`generalApps` / `openRfps` / `donations`) in
  sync with the profile text.** If an RFP closes or applications open, flip
  the flag and update the prose in the same PR.
- **For any time-sensitive opportunity whose date has passed**, use the link
  or a search to confirm whether the deadline was extended. If extended,
  update the date; if truly passed, reword to the durable state — e.g. an
  expired RFP becomes "They post periodic RFPs, but otherwise don't accept
  unsolicited proposals."
- **Click every link on the page** to verify it still exists and says what is
  claimed.
- **Make changes consistently in both the At-a-glance table and the funder
  profiles** whenever both apply.
- Refresh "Recent updates" bullets with notable grants or announcements, and
  "Get involved" with current job openings. Keep only updates from roughly the
  last month; delete older bullets, and drop the "Recent updates" section
  entirely when a funder has nothing new. Keep it short: skip details that
  aren't relevant to AI safety, such as roles closed or programs outside AI
  safety.

Also consider whether significant new information has come out about anything
in the "Not included" section.

Funder list with primary URLs (update this list too if funders change):

- Coefficient Giving — https://coefficientgiving.org/ (grants: https://coefficientgiving.org/funds)
  (we look at only the Transformative AI and GCR Opportunities Funds)
- Longview Philanthropy — https://www.longview.org/
  (see footnotes on how to estimate money moved to AI in 2026)
- OpenAI Foundation — https://openaifoundation.org/
- Macroscopic — https://macroscopic.org/
- Survival and Flourishing Fund (SFF) — https://survivalandflourishing.fund/
- Lightcone Commons — https://www.lightconecommons.com/
- Schmidt Sciences — https://www.schmidtsciences.org/focus-area-ai/
- AI Safety Tactical Opportunities Fund (AISTOF) — no website; search for news
- Manifund — https://manifund.org/
  (you can get the exact funding numbers from https://manifund.org/about)
- BlueDot Impact — https://bluedot.org/
- Long-Term Future Fund (LTFF) — https://funds.effectivealtruism.org/funds/far-future

## Editing rules

- Only change facts you can back with a citable source; put the source URL
  next to each change in the PR body.
- If you can't verify a figure after genuinely trying, leave it alone.
- The PR body should also include a short per-funder research log: what was
  checked and what was found, including funders where nothing changed.
- Update `LAST_UPDATED` if and only if you changed content.
- If nothing material has changed, make no edits and open no PR.

## Verification

`bun install && bun run build` must pass before opening a PR.
