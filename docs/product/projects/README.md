# Projects (grant requests)

Stub. To be written the way `../comments/README.md` is: what projects are for, how they're built, numbered rules
(`P1`…), decisions, open questions, tests.

Until then: the overview is in `../intent.md` ("Grant requests", "Giving", "Regranting", "Evaluation and quality");
the lifecycle rules live in `utils/activate-project.ts`, `pages/api/close-grants.ts` and the SQL functions
`activate_proposal`, `reject_proposal`. Before a proposal activates, each pending offer is checked against its
offerer's current balance (offers they no longer cover are declined), and `activate_proposal` accepts exactly the
offers that were checked.
