# Follows (people and saved searches)

What people keep up with on Manifund besides their own things: other people, searches they saved, and projects
(following a project predates this area; its rules stay with comments and notifications). Notifications and their
email settings: `../notifications/README.md`.

## What it's for

- **Keeping up without browsing.** A funder follows people whose taste they trust and saves the searches they
  care about, then hears about new projects instead of checking the site.
- **Taste travels through people.** Seeing that someone you follow gave to or discussed a project is a signal
  (Vals, 2026-10-07: "a tag for ~'received attention from your network'").

## How it's built

- **`profile_follows`** (follower, followed: following someone covers everything they do) and
  **`saved_searches`** (owner, a name, a query string; no pausing: a search exists or is removed). Both private:
  people read only their own rows; only server code (`lib/follows`) writes them.
- **A saved search is home's search text and categories** as the address keeps them (`?q=...&cause=...`), matched
  against new projects the way home's search box and category picker would (`lib/follows/match.ts`).
- **Notifications** go through the notifications table with four reasons in two settings rows ("People you follow"
  and "New projects matching your saved searches"), each right away or weekly (N3, N6).
- **The network line** (F8): `network_activity()` (a database function that runs as the viewer, so it reads only
  their own follows) gives, by project, who they follow did what; `lib/follows/network.ts` words it.

## Rules

- **F1** Following someone covers everything they do: new projects, comments, donations and offers. One button
  on their profile follows or unfollows them, the same small bookmark button as a project's Follow (grey and
  outlined to follow, orange and filled while following); the Following page unfollows too. How often the emails come is a
  notification setting. Nobody follows themselves.
- **F2** Follows and saved searches are public: anyone can see on someone's profile the people, projects and
  searches they follow (F9; Vals, 2026-10-14: "it's interesting to be able to see a regranter's search"). Browsers
  can't write them, and read only their own rows directly; the profile shows the rest.
- **F3** When someone you follow publishes a project, you're notified.
- **F4** When someone you follow comments anywhere (on a project, a profile, or an org page, reviews included), or
  donates or makes an offer on a project, you're notified. One notification per person per comment: a stronger
  reason, like a comment on your own project, wins. A project's creator isn't notified twice about money to their
  own project.
- **F5** On the home page, once there is a search (search text, or categories picked), a line appears under the
  search box: how many projects match, and "Notify me of new matches", which saves the search text and categories
  as a search, named from them ('"probe" in Technical AI safety'). It appears a moment after typing stops, and
  goes when the search is cleared ("just in time", Vals, 2026-10-14). While the search is saved the line says
  "Notifying you of new matches", with Stop. The search and categories are kept in the address, so a search can be
  shared and comes back after signing in. How often the emails come is the notification setting, not a choice
  here. Signed out, the button opens sign-up or sign-in, which comes back to the same search.
- **F6** A project that is published, or whose categories change, notifies the owners of the saved searches it
  matches (not its own creator): it has one of the search's categories (any, when none was picked), and the search
  text is in its title, subtitle or creator's name.
- **F7** Saved searches tell each person about a project once at most: not again when it changes, not once per
  matching search, and not at all if they were already notified about it for another reason (someone they follow
  posted it or commented on it). A notification counts whether its email went out, waits for the daily summary or
  isn't sent. A match always lands in the notification list; its email follows the one email choice (immediately,
  daily or never: docs/product/notifications N4), like other optional notifications.
- **F8** When people you follow donated, offered or commented on a project, at any time, a line says so above its
  home card, outside the card on a small tab joined to its top edge, the way social feeds put "reposted by" above a
  post (Vals, 2026-10-14), and above
  the title on the project page: "Maya donated and commented, Sam offered", up to two people, each named once,
  then "and N more", after the two-people icon whatever they did (Vals, 2026-10-14). Cards side by side stay aligned
  whether or not they have a line. Drafts and hidden projects never count. No "From your network" label (Vals,
  2026-10-12); screen readers and the hover text say "People you follow". On a card the line stays on one line.
- **F9** A profile's Following section lists the people, projects and saved searches that person follows, for
  anyone (drafts and hidden projects only for the owner). On your own profile it lets you unfollow or remove, each
  button with an icon (no pausing a search: Vals, 2026-10-14); what you remove stays, faded, with Undo until you leave the page. Long lists
  show five rows and "Show all". There's no separate Following page
  (Vals, 2026-10-14).
- **F12** Home has a Network tab for signed-in people: the newest 50 things people you follow did (new projects,
  comments anywhere with a short excerpt, donations and offers with their amounts), each linking to the project or
  comment. Comments on hidden projects or hidden org pages, and drafts or hidden projects, stay out. With nothing
  to show, it explains how to follow people. It loads when the tab opens (`/api/network`).

## Decisions

Newest first.

| Date       | Decided by                                 | Decision                                                                                                                                                                                                                         | Why                                                                  |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2026-10-14 | Vals                                       | The Network tab stays: "it's like twitter" (F12)                                                                                                                                                                                 | Q25 cut "Network first" and the Hot boost; Q29 kept the tab          |
| 2026-10-14 | Vals                                       | Save a search from a line that appears under the search box once there is a search, not an always-visible bell (F5)                                                                                                              | "just in time ... simple, elegant"                                   |
| 2026-10-14 | Vals                                       | The network line sits above the card, not in it (F8)                                                                                                                                                                             | "like twitter 'reposted by' is not in tweet but surrounding"         |
| 2026-10-14 | Vals                                       | Following people and projects share one bookmark button (F1)                                                                                                                                                                     | "standardize ... change icon from eye to bookmark"                   |
| 2026-10-13 | Vals                                       | The bell has no frequency choice: saved searches follow their settings row (F5)                                                                                                                                                  | Q22: fewer choices in more places                                    |
| 2026-10-12 | Austin (team meeting), Vals                | Keep following people and saved searches; the home filter panel (amount, status, AI, network filter), "Network first" and seen marks are left out, so a saved search is the search text and categories home already has (F5, F6) | Fewer database changes and a smaller change to the most-visited page |
| 2026-10-12 | Vals                                       | Following someone covers everything they do: no per-follow switches (F1, F3, F4, F9)                                                                                                                                             | "remove the switches, have it follow all, simpler less complexity"   |
| 2026-10-12 | Vals                                       | The network line shows just the actions, without "From your network" (F8)                                                                                                                                                        | "it shouldn't show 'from your network' part, just the actions"       |
| 2026-10-09 | Vals                                       | "People you follow" and saved-search emails weekly by default                                                                                                                                                                    | "I'd have all emails default to weekly"                              |
| 2026-10-09 | Vals                                       | One notification per person per project from saved searches (F7)                                                                                                                                                                 | "okay for 'one notification per project' rule"                       |
| 2026-10-09 | Vals                                       | Your network is everything people you follow did, at any time (F8)                                                                                                                                                               | "simpler system here, no cutoff on how long it counts for"           |
| 2026-10-09 | Vals                                       | The bell shows to signed-out visitors too, with "Sign up or sign in" (F5)                                                                                                                                                        | "as an incentive to get them to signup"                              |
| 2026-10-08 | Vals                                       | Following someone covers their comments everywhere: on projects, profiles and org pages, reviews included (F4)                                                                                                                   | "yes to both"                                                        |
| 2026-10-07 | Claude, tentative (Vals: fine, 2026-10-09) | Saved searches share one email setting instead of a frequency per search                                                                                                                                                         | Fewer choices                                                        |
| 2026-10-07 | Vals                                       | Follows are private; no cap on saved searches (F2)                                                                                                                                                                               | "private ig"; "no cap ig"                                            |
| 2026-10-07 | Vals                                       | A line on projects that got attention from people you follow (F8)                                                                                                                                                                | Surfaces taste through people                                        |
| 2026-10-05 | Vals                                       | Subscriptions to projects, people and saved searches                                                                                                                                                                             | Funders keep up without browsing                                     |

## Open questions

- The line's wording (F8), and whether it also counts people who follow the project.
- Programs (funds, rounds) as things to follow: later (Vals, 2026-10-05).

## Tests

Each test names the rule it checks: unit `tests/unit/follows-match.test.ts` (F5, F6, F8); database
`tests/db/profile-follows.test.ts` (F2, F8); routes `tests/routes/follows.test.ts` (F1, F3, F4, F5, F6, F7) and
`tests/routes/network.test.ts` (F12). No tests yet for F9 and the search line's looks.
