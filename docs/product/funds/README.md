# Funds

A fund is a pot of money on Manifund that a few people grant from together: donors give to it, its admins give
from it to projects. One page (`/<username>`, also `/funds/<username>`) shows what it is, what it has raised and
given, and how to donate.

Falcon Fund predates this and is still built from an individual profile, a fundraising project and a cause; it moves
over later.

## How it's built

- **A fund is a profile** with `type = 'fund'`. It has no login; nobody signs in as it.
- **`fund_admins`** (fund, person) lists who may give from it. Written by the service role only, by hand.
- **Giving as the fund** goes through the same routes as giving as yourself (`/api/place-bid`, `/api/transfer-money`),
  which check `fund_admins` and then write with the fund as the giver.
- **Applications** are projects tagged with a cause whose `fund_id` is the fund (a "prize" cause, chosen on the
  create form).

## Rules

- **F1** A fund's page is at its username; a username that isn't a fund's shows that profile as usual.
- **F2** Only a fund's admins give from it: from any project's donate box, by choosing "Give as <fund>". It's an
  offer on a proposal or a donation on an active project, with the same limits as anyone's, checked against the
  fund's balance. Site admins aren't fund admins unless listed.
- **F3** Donations to a fund (from a balance, by card or by wire) are grantable charity balance, never withdrawable.
- **F4** The page's figures: **raised** is every dollar given to the fund; **granted** is every dollar it has given
  out (project donations and profile donations); **available to grant** is its balance less its pending offers,
  never shown below $0 (ACX Grants paid grants with money that never came through Manifund).
- **F5** Below the stats and donate box, tabs: **About** (the long description; the default tab), **Grants** (a card per project it paid or has a pending offer on, newest first, each topped by what the fund granted and offered; then rows for grants to people), **Applications** (when
  the fund has a cause), **Donations** (who gave to the fund).
- **F6** Applications are the projects tagged with any of the fund's causes, hidden and draft ones left out. While a
  cause is open, "Apply for a grant" opens the create form with it chosen. The cause's own page links to the fund.
- **F7** Funds and their admins are created by hand (`scripts/create-fund.ts`).
- **F8** A fund's admins can withdraw its pending offers from the project's Offers tab, as anyone withdraws their own
  (`/api/withdraw-fund-bid`, which checks `fund_admins`).
- **F9** A donation to a fund, from a balance or by card, notifies each of its admins in-app and by email right away
  (`donation_to_your_fund`, essential like other money to you).

## Decisions

| Date       | Decided by | Decision                                                                                   | Why                                                       |
| ---------- | ---------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 2026-11-11 | Caroline   | Build on the existing `fund` profile type, with `fund_admins`, for the new fund            | One page instead of a profile, a project and a cause      |
| 2026-11-11 | Caroline   | Falcon Fund stays as it is for now                                                         | Prove the model on the new fund before moving a live fund |
| 2026-11-11 | Caroline   | Applications through a cause, as Falcon does (F6)                                          | The create form already handles it                        |
| 2026-11-11 | Caroline   | Either admin gives alone; no approval step (F2)                                            |                                                           |
| 2026-11-11 | Caroline   | Admins withdraw fund offers and hear about donations (F8, F9); regrantor-style grants wait |                                                           |

## Open questions

- Regrantor-style grants (a fund creating a project for a grantee, `give_grant_v2`) aren't available as a fund.

## Tests

- **Routes**: F2 (`tests/routes/funds.test.ts`).
