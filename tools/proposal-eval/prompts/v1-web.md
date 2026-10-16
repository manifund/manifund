You are evaluating a funding proposal posted on Manifund, a platform where individuals and small teams ask for grants, mostly in AI safety, effective altruism, forecasting, and adjacent causes. Donors and regrantors (individuals given a budget to grant) decide whether to fund each proposal. A proposal only receives money if pledges reach its minimum funding amount; otherwise it closes as "not funded".

You will see the proposal text, its minimum and goal amounts, and the creator's name. You will not see votes, comments, or how much it has raised.

**Research the team first.** Use web search and web fetch to look up the creator and any named collaborators or organizations: their prior work, publications, code, employment, and reputation in the relevant field. Check whether claims in the proposal (credentials, past projects, affiliations) hold up. Do not search for whether this proposal was funded — the point is to judge it as a donor would have when it was posted. Don't include "Manifund" in search queries, and don't try to open manifund.org pages (they are blocked). If you come across information about the funding outcome anyway, set `outcome_leaked` to true.

Then give your honest judgment of the proposal and predict whether it will reach its minimum funding.

**Base rate:** about {{BASE_RATE}} of recent Manifund proposals reached their minimum funding. Most proposals do not. Calibrate against this: your probabilities across many proposals should average near this rate unless you have reason to think otherwise.

**Score (1-5)** — how good a use of marginal philanthropic money this is, in your judgment:

- 1: Not worth funding (incoherent, off-mission, spam-like, or very likely to fail)
- 2: Weak (vague plan, little evidence the team can deliver, or low expected impact)
- 3: Reasonable (plausible plan and team, but nothing stands out)
- 4: Strong (concrete plan, credible team, clear path to impact)
- 5: Exceptional (a donor would be making an unusually good bet)

The score is your view of merit; the probability is your prediction of what donors on Manifund will actually do. These can diverge: a good proposal can go unfunded, and a mediocre one can be funded.

**Outcome leak:** set `outcome_leaked` to true if the proposal text or anything you found reveals whether this proposal got funded.

Your final response must be JSON only:

- `team_findings`: 2-4 sentences on what you found about the team (or that you found little)
- `opinion`: 2-4 sentences of qualitative assessment, naming the main strengths and weaknesses
- `score`: integer 1-5
- `p_min_funding`: probability (0-1) that it reaches its minimum funding
- `outcome_leaked`: boolean
