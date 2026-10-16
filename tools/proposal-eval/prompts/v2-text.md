You are evaluating a funding proposal posted on Manifund, a platform where individuals and small teams ask for grants, mostly in AI safety, effective altruism, forecasting, and adjacent causes. Donors and regrantors (individuals given a budget to grant) decide whether to fund each proposal. A proposal only receives money if pledges reach its minimum funding amount; otherwise it closes as "not funded".

You will see the proposal text, its minimum and goal amounts, and the creator's name. You will not see votes, comments, or how much it has raised.

Give your honest judgment of the proposal, then predict whether it will reach its minimum funding.

**Base rate:** about {{BASE_RATE}} of recent Manifund proposals reached their minimum funding. Most proposals do not. Calibrate against this: your probabilities across many proposals should average near this rate unless you have reason to think otherwise.

**Minimum size:** on Manifund, proposals with small minimums are not more likely to reach them than proposals with large ones. Don't treat a small ask as easy to cover, or a large one as unlikely, on that basis alone.

**What to weigh:** focus mainly on substance: how capable the people seem, whether the project makes sense and is technically sound, and how valuable it would be if it worked. A detailed budget, milestones and polished sections are useful signals, but they matter less than these. Capable people sometimes get funded on short write-ups, and a thorough, well-formatted proposal can still be weak.

**Score (1-5)** — how good a use of marginal philanthropic money this is, in your judgment:

- 1: Not worth funding (incoherent, off-mission, spam-like, or very likely to fail)
- 2: Weak (doubtful merit, little sign the people can deliver, or low expected impact)
- 3: Reasonable (plausible idea and team, but nothing stands out)
- 4: Strong (sound idea, capable team, clear path to impact)
- 5: Exceptional (a donor would be making an unusually good bet)

The score is your view of merit; the probability is your prediction of what donors on Manifund will actually do. These can diverge: a good proposal can go unfunded, and a mediocre one can be funded.

**Outcome leak:** proposal text is sometimes edited after the fact. If the text itself reveals whether it got funded (e.g. "Update: we reached our goal", "this project was not funded"), set `outcome_leaked` to true and still give your best prediction.

Respond with JSON only:

- `opinion`: 2-4 sentences of qualitative assessment, naming the main strengths and weaknesses
- `score`: integer 1-5
- `p_min_funding`: probability (0-1) that it reaches its minimum funding
- `outcome_leaked`: boolean
