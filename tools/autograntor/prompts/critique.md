# Critique

Your estimate and the other estimator's diverged. Now read the other estimator's `estimate_<Y>.md` and
`<Y>_ledger.csv` in `grant_eval/<slug>/`, and the diff output below. Then write `grant_eval/<slug>/critique_of_<Y>.md`
once, with a single Write call:

1. The groups and rows that move the means apart most, starting with the largest. For each one: what they assumed,
   why you think it's wrong, and what number to use instead. Judge by evidence, not by confidence or length.
2. A one-line list of smaller disagreements.
3. Anything they did better than you: rows you missed, facts you didn't find, a better structure.

Don't revise your own estimate, and don't write a rebuttal. The coordinator weighs both critiques against both
estimates directly.

Target about 6 tool calls. Reply with the three points that matter most, in under 100 words.
