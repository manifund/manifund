# Projects (grant requests)

Stub. To be written the way `../comments/README.md` is: what projects are for, how they're built, numbered rules
(`P1`…), decisions, open questions, tests.

Until then: the overview is in `../intent.md` ("Grant requests", "Giving", "Regranting", "Evaluation and quality");
the lifecycle rules live in `utils/activate-project.ts`, `pages/api/close-grants.ts` and the SQL functions
`activate_grant`, `reject_proposal`.

## Rules (first ones)

- **P1** Only the server moves a project into a stage that follows a decision or a funding outcome: active, not
  funded, or back to proposal. People publish their draft as a proposal, close their active project (complete) and
  hide their project; a project they create starts as a draft or a proposal. A certificate program without a
  proposal phase starts its projects active only while it's open, as stored in the database. Regrants always create a
  grant proposal. Enforced by the trigger `protect_project_stage`; test: `tests/db/project-stage.test.ts`.
