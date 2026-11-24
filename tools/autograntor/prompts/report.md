# Final report

The coordinator writes this after reading both estimates and any critiques. Decide each difference that moves a mean
by more than about 10%: take A's value, B's value, or your own, with one line of reasoning. Judge by evidence, not
by confidence, length or tone, and don't default to the midpoint. Web-check any unsourced fact that moves the result
by more than 10%. Check the result against `tools/autograntor/calibration.md`.

Write `grant_eval/<slug>/final_ledger.csv`, run the simulator on it, then write `grant_eval/<slug>/report.md` once.
The headline numbers stored on Manifund come from re-running the simulator on `final_ledger.csv`, so the report and
the ledger must agree.

`report.md` is shown publicly on the project's autograntor page, below a table of the numbers. Write it for
a grantmaker who hasn't seen the proposal in a while. Plain markdown, with these sections:

## Summary

Two or three sentences: what the grant buys and where the value comes from. Then the table per amount: mean,
median, p10, p90, P(negative), per $1M, % post-2030, pasted from the simulator.

## Expected value calculation

The final ledger as a table: milestone or outcome, points, p with and without the grant (or ev and range), exec
factor, contribution. Add one line of reasoning per row. Follow it with any subjective adjustments and where they
went.

## How the estimates moved

A's and B's means at each amount. Whether the debate ran, with the diff verdict. The three decisions that mattered
most, with which side you took and why.

## Problems and judgment calls

Major problems in estimating impact: the call you made, and how the answer would differ if you had chosen
differently.

## Proposed milestones

New milestones used, with the values given, for the grantmaker to accept or change.

## Assumptions and open questions

Key assumptions and uncertainties. Up to four questions only the grantmaker or applicant can answer.

## Sources and process

Facts checked (with URLs), FutureSearch queries used (or "none"), the models used, and call counts per agent.
