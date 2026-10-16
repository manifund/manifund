# Donor survey

> Agent-written from the code in October 2026: it describes what the code did then, not decisions the team made. Optional: use or update it when asked ([about this folder](../README.md)).

A survey for donors at `/donor-survey`: how much they plan to give, to which causes, how they like to give, and
whether Manifund may stay in touch. Respondents see what other donors answered, and can publish their own answers
on their profile (`/<username>/donor`). How it changed since it shipped: `history.md`.

Backfilled 2026-10-08 from the code and its history: the rules say what the product does today ("observed"), not
what anyone decided it should do, unless a decision is cited. Neighbouring areas: who is an admin is `../admin/`
(M1, M2), the profile page around the donor-page link is `../people/` (U11, U12), sign-in is `../accounts/` (S).

## What it's for (draft, for the team to confirm)

From the original brief (Austin, 2026-09-08, `docs/plans/donor-survey-2026-09-08.md`) and its preface:

- **Help donors decide where to give without asking each one for money.** "I want to help you figure out where to
  donate, but I also don't want to be bugging you too often" (Austin, the survey's preface).
- **Learn what donors want**: amounts for 2026 and 2027, cause interest, funds vs. picking charities, what a dream
  setup for giving looks like, where they go for advice.
- **Give something back**: after answering, people see live tallies of everyone's answers; aggregate results are to
  be published "in a couple of weeks".
- **Optional public record**: a donor can publish their answers on `/<username>/donor` (example: `/Austin/donor`),
  and say whether Manifund may share them with other major funders.
- **Stay in touch**: opportunities sent to them, a 1:1 call, fundraising events.

## How it's built

- **One table, `donor_survey_responses`**, one row per respondent: name, email, the answers (one column per
  question; cause interest as `cause_ratings`, a JSON list of `{ name, rating }`), the sharing and contact choices,
  `profile_id` (the account, when there is one) and `edit_token_hash`.
- **Two kinds of respondent.** Signed in: the row is the account's. Signed out: identified by the email they type,
  and by an edit token: emailed as a link and kept in a cookie on their browser; only the token's sha256 is stored
  (the same scheme as grant-agreement signing links, `utils/signing-token.ts`).
- **Server code reads and writes everything** with the service role (`db/donor-survey.ts`, the server action
  `app/donor-survey/actions.ts`). Row-level security only lets a signed-in person read their own row, so the
  database API exposes no one else's email or token. Published pages pick what to show in server components
  (`components/donor-response-view.tsx`), so the full row never reaches the browser.
- **The question vocabulary** (option keys, labels, causes, the empty form) is in `utils/donor-survey.ts`, shared
  by the form, the server action and the display pages.
- **Pages**: `/donor-survey` (the form), `/donor-survey/results` (tallies, `results/aggregate.ts`),
  `/<username>/donor` (one donor's answers), `/donor-survey/responses/<id>` (one response, for admins and the
  owner; it exists because signed-out respondents have no username). `/donor-survey` and its sub-pages stand alone,
  without the site's sidebar (`app/shell.tsx`).
- **Not linked from the site's navigation**: the survey is shared by direct link. Profiles link to the donor page
  (D19).

## Rules

Ids are stable once merged: tests name them, and a removed rule keeps its id in `history.md`. All observed (code,
2026-10-08) unless a decision is cited.

### Taking the survey

- **D1** Anyone can take the survey at `/donor-survey`, signed in or not: "Sign in with Manifund" (which returns to
  the survey), or type a full name and an email.
- **D2** Required: a name and an email (or being signed in), at least one giving capacity (own money, part-time
  regrantor or evaluator, fulltime grantmaker), and an amount band for 2026 and for 2027 (2027 also has "Not sure
  yet"). Until they're answered the form says what's missing; the server refuses a save without them, with a short
  message ("Enter your name.", "Enter a valid email.", "Pick at least one option.", "Pick a range."). Everything
  else is optional.
- **D3** The server keeps only answers it knows: capacities, amount bands, hours per month and opportunity
  frequency from their option lists (anything else is dropped or left unanswered); the frequency only when the
  person wants opportunities; the organisation only with a capacity other than "own money"; funds vs. picking
  charities only as a whole percentage from 0 to 100 in steps of 5 (the database refuses other values too). Text is
  trimmed and capped (10,000 characters; name 200, email 320, organisation 300, link 2,000); empty means
  unanswered. Emails are stored lowercased. Unticked choices are saved as no.
- **D4** Cause interest: nine causes (five shown, four behind "Show more"), plus causes the person adds, each rated
  1 to 5 (unrated causes aren't saved). The server keeps entries with a name (trimmed, up to 80 characters) and a
  whole rating from 1 to 5, one per name ignoring case, at most 50.
- **D5** One response per person: per account, and per email ignoring case (the database refuses a second). Saving
  again changes the same response.
- **D6** Coming back to `/donor-survey` shows the saved answers to edit (signed in: the account's response, else the
  one under the account's email; signed out: the one the edit link or this browser's cookie opens). After a save,
  the person lands on the results.

### Signed in

- **D7** A signed-in save is the account's: the account's email replaces the typed one, the profile's full name
  replaces the typed name (when the profile has one), and the response is linked to the account. An earlier response
  under the account, or else under its email (e.g. answered signed out before), is updated and becomes the
  account's.

### Signed out

- **D8** A signed-out save is never public: "On your public Manifund profile" is saved as no, and ticking it shows
  that public pages need an account (Vals' fix in #265, 2026-09-28).
- **D9** A first signed-out save under an email with no answers creates the response, linked to the account that
  has this email, if any; emails an edit link (`/donor-survey?token=…`) to that address; and keeps the same token in
  a cookie on this browser (sent only to `/donor-survey` pages, for a year, unreadable by scripts).
- **D10** With the edit link or the cookie (the link wins), a signed-out person changes their own response,
  including its email, unless another response already uses that email ("Another response already uses this
  email.").
- **D11** A signed-out save without a valid token, under an email that already has answers (or whose account has),
  changes no answers: it emails a new edit link to the address on that response (the earlier link stops working)
  and says "There are already answers under <email>. We just emailed a link to that address. Open it to change
  your answers."

### Results

- **D12** `/donor-survey/results` is for admins and people who answered (signed in, or on the browser that holds
  their cookie). Anyone else sees "Sorry, the results are only visible to people who have filled out the survey."
  and a link to take it. (A switch in the code, `RESULTS_ARE_PUBLIC`, opens it to everyone; it's off.)
- **D13** The results are live tallies of every response: amount bands for 2026 and 2027; per cause, how many gave
  each rating and the average (highest average first, then most ratings); the average on funds vs. picking
  charities; hours per month (out of those who answered); capacities (people could pick more than one); how many
  want opportunities, by frequency; how many want to come to events. Text answers, 1:1 calls and sharing choices
  aren't tallied (Vals, 2026-09-28: "Staying in touch" on results shows only opportunities and events).
- **D14** A respondent sees their own answers marked in each chart, and a "What happens next" box saying how their
  answers are shared (with funders, on their profile, or private to them and the team), with a link to edit.
- **D15** "Donors who published their answers" lists public responses linked to an account, each linking to
  `/<username>/donor` (name, capacity and organisation, 2026 band). Admins also see every response ("All
  responses": name, email, organisation, 2026 band, whether public, shared with funders, or without an account),
  each linking to `/donor-survey/responses/<id>`.

### One donor's answers

- **D16** `/<username>/donor` shows the donor's answers to everyone once they chose to publish them. Until then only
  the donor and admins see it, with a "Not public yet" note (the donor also gets a link to change that); anyone else
  gets the site's not-found page, as for an unknown username or someone who didn't answer.
- **D17** Visitors see the name, `@username`, capacity and organisation, 2026 band and the date of the last change,
  and only the questions the donor answered among: amounts, cause ratings (highest first), advice sources, problems
  with the giving landscape, funds vs. picking charities, where they gave (text and link), how they evaluate, charities
  they might give to, hours per month, dream setup and other thoughts. Never the email, who else should take the
  survey, the contact choices or the sharing choices.
- **D18** The donor and admins also see the email, who else should take the survey, whether they want opportunities
  (and how often) and events, and unanswered questions as "—"; admins also see the 1:1 call and the sharing choices
  (Vals' default, 2026-09-28).
- **D19** A profile links to its donor page ("Donor survey answers") when the answers are public, and for the donor
  on their own profile (Vals, 2026-10-05, #281).
- **D20** `/donor-survey/responses/<id>` shows one response, as the donor page shows it to the donor, to admins and
  to the account it belongs to; anyone else gets the not-found page.

### Storage

- **D21** Browsers write no responses, and read only their own (the one linked to their account); visitors read
  none. The read-only SQL role behind the MCP server reads none either.
- **D22** Deleting a profile keeps its response, no longer linked to an account.

## Decisions

Newest first. From the PRs and the donor-survey thread's notes; the original brief is
`docs/plans/donor-survey-2026-09-08.md`.

| Date | Decided by | Decision | Why |
|---|---|---|---|
| 2026-10-05 | Vals | The profile links to the donor page (D19); the donor page shows funds vs. picking charities on the results' scale; visitors see only answered questions (D17) (#281) | Findable; same reading as the results; no empty sections for visitors |
| 2026-10-05 | Vals | Results grouped under the survey's headings, percentages kept with empty rows dimmed, rating spread per cause (D13) (#281) | Easier to read; the average alone hid how ratings split |
| 2026-09-28 | Vals | "Staying in touch" on results: only opportunities and events (D13); on a donor page the donor sees those two, admins all five (D18, the coordinator's default) | 1:1 calls and sharing are for the team to act on |
| 2026-09-28 | Vals | Signed-out answers can't be published (D8); emails matched exactly, not as patterns (D5, D11); the profile's name for signed-in saves (D7) | A typed email is unverified: it mustn't publish answers on someone else's page |
| 2026-09-28 | Austin | Cause interest rated 1 to 5 instead of split by percentage; funds vs. picking charities in steps of 5 (D3, D4) | (from the migration; reason not recorded) |
| 2026-09-28 | Vals | Rating dots instead of stars; the results gate's wording (D12) | Testing locally |
| 2026-09-08 | Austin | The survey, its copy, results for respondents, optional public donor pages | The brief, `docs/plans/donor-survey-2026-09-08.md` |

## Open questions

- **The emailed results link doesn't open the results on a new device.** The edit-link email says "The same link
  also gets you to what other donors answered" and links `/donor-survey/results` without the token
  (`app/donor-survey/actions.ts:127`). The results page only reads the cookie (`results/page.tsx:36`), and opening
  the edit link doesn't set the cookie (only saving does, `actions.ts:196`, `:223`). So a signed-out respondent on
  another browser sees the gate until they open the edit link and save again. Fix: set the cookie when the edit link
  is opened, or pass the token on to the results.
- **Email failures aren't shown.** Since 2026-10-09 a failed edit-link email is logged (`email.failed`), but the
  page still says "We just emailed a link" (D11). Should it say the email failed?
- **The not-found page answers with HTTP 200** on `/<username>/donor` and `/donor-survey/responses/<id>` (they
  render the not-found component rather than calling `notFound()`), as some other pages do.
- **Emails are matched lowercased**, assuming account emails are stored lowercase (Supabase normalizes them; true
  locally, not checked in production).

## Later

- Publish the aggregate results (flip `RESULTS_ARE_PUBLIC`), as the preface promises.
- Link the survey from somewhere on the site, if it's meant to stay open.

## Tests

Run locally: see `tests/ai-reference/README.md`. Each test names the rules it checks.

- **Logic** (`tests/ai-reference/unit/donor-survey.test.ts`): D4 (which cause ratings are kept), D13 (the tallies), the option
  vocabulary behind D2 and D3.
- **Components** (`tests/ai-reference/components/donor-survey.test.tsx`): D17, D18 (what visitors, the donor and admins see).
- **Database** (`tests/ai-reference/db/donor-survey.test.ts`): D3 (the funds check), D5 (one response per account and per email),
  D21 (no browser writes; people read only their own), D22.
