# Projects (grant requests)

Stub. To be written the way `../comments/README.md` is: what projects are for, how they're built, numbered rules
(`P1`…), decisions, open questions, tests.

Until then: the overview is in `../intent.md` ("Grant requests", "Giving", "Regranting", "Evaluation and quality");
the lifecycle rules live in `utils/activate-project.ts`, `pages/api/close-grants.ts` and the SQL functions
`activate_proposal`, `reject_proposal`. Before a proposal activates, each pending offer is checked against its
offerer's current balance (offers they no longer cover are declined), and `activate_proposal` accepts exactly the
offers that were checked.

## AI evaluation

Claude reads each project as a donor would see it and records a 1-5 merit score, a 2-4 sentence opinion, and the
probability it reaches its minimum funding (`project_ai_evals`). The score feeds the homepage's top sort and the weekly
digest; highly rated projects show it on their pages. The prompt was chosen by testing on closed proposals
(`tools/proposal-eval`).

- **P1** Projects posted on or after 1 July 2026 are evaluated; earlier ones aren't, since the model may have seen
  them, outcomes included, in training.
- **P2** The model sees the title, blurb, description, minimum, goal, posting date and creator's name; never votes,
  comments or money raised.
- **P3** A project is evaluated when it's created, published or edited, with a nightly run catching any missed.
  After its first evaluation, edits are evaluated again only while it can still take money (proposal or active).
- **P4** Evaluations are never overwritten: each new text gets its own row, with the stage it was in, so the
  evaluation made when a proposal was posted survives later edits.
- **P5** Evaluations are public, like the rest of a project's data.
- **P6** When the model declines to evaluate a project (some biosecurity proposals), that is recorded and not
  retried for the same text.
- **P8** The first time a project is evaluated 4 or 5, it is posted to the team's Discord alerts channel with its score, chance
  of reaching its minimum, and Claude's opinion. Later evaluations of the same project don't post again.
- **P9** The homepage top sort adds a head start to a project's karma from its AI score (1: -1, 2: +1, 3: +3,
  4: +10, 5: +15; `aiScoreBoost` in `utils/karma.ts`) before the age decay, so new projects start from Claude's
  judgment and community karma takes over as it builds. Karma itself stays human-only. The score used is the latest
  evaluation.
- **P10** The weekly digest shows projects in two sections. First, _featured_: proposals whose
  AI score is 4 or 5 and that are below their minimum, shown twice, in the week they first qualify and the week
  before they close. Then _new this week_: projects posted in the last 7 days, except AI-written ones the homepage
  hides, whose karma plus the AI head start (P9) is above 3, highest first, up to 7. Rules in
  `utils/digest-projects.ts`.
- **P11** A project whose AI score is 4 or 5 shows a trophy on its card and next to its title ("highly rated by our
  experimental AI rating system"), and an _AI review_ tab after Comments, Offers, Shareholders and Donations with the score and Claude's
  opinion. Lower-rated projects show neither. The evaluation shown is the latest, as in P9.

## Stage

- **P7** Only the server moves a project into a stage that follows a decision or a funding outcome: active, not
  funded, or back to proposal. People publish their draft as a proposal, close their active project (complete) and
  hide their project; a project they create starts as a draft or a proposal. A certificate program without a
  proposal phase starts its projects active only while it's open, as stored in the database. Regrants always create a
  grant proposal. Enforced by the trigger `protect_project_stage`; test: `tests/db/project-stage.test.ts`.
