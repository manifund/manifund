# Donor survey: history

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

How the survey changed since it shipped. The current rules are in `README.md`.

- **2026-09-08**: Austin's brief (`docs/plans/donor-survey-2026-09-08.md`): a single-page survey, a response table,
  public donor pages, a results dashboard.
- **2026-09-08 to 09-28, #265** (Austin, merged 2026-09-29): the first version. Cause interest was first a split
  by percentage (`cause_allocation`, `[{ name, pct }]` summing to 100) and funds vs. picking charities a choice of
  0, 25, 50, 75 or 100. Migration `20260928000000` replaced them with 1-to-5 ratings (`cause_ratings`) and steps of
  5; the old column was dropped. A second input for a link to a giving history was added (`already_given_link`).
  Before merging, Vals' review added: signed-out answers can't be published, exact email matching, the profile's
  name for signed-in saves, rating dots instead of stars, the results gate's wording, and "Staying in touch" on the
  results limited to opportunities and events.
- **2026-09-30, #270**: the donor page's date no longer depends on the server's time zone.
- **2026-10-05, #281** (Vals): design pass. The donor page uses the site's layout, shows visitors only answered
  questions, and is linked from the profile; results grouped under the survey's headings with the rating spread
  per cause; a section list with progress in the left margin on wide screens.
