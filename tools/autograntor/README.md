# Autograntor

Estimates the utility of funding a Manifund proposal, in milestone points: a Plan A US–China pause = 1,000,000
(`milestones.md`, Caroline's values). It scores the minimum, the goal, and $10k if $10k falls between them. Modeled on
Scott Alexander's autograntor, simplified: no Common Law, and this folder's own ledger simulator. Rules P18–P21 in
`docs/product/projects/README.md`.

Run it from Claude Code in the repo: `/autograntor <slug>` (`.claude/skills/autograntor/SKILL.md`). The skill:

1. stages the proposal with `fetch.ts`
2. runs two independent estimators (Opus and Fable) with `prompts/estimator.md`
3. compares their ledgers, with a critique round only if they diverge (`prompts/critique.md`)
4. writes a final ledger and report (`prompts/report.md`)
5. saves them with `publish.ts` to `project_autograntor_evals`, shown publicly at `/projects/<slug>/autograntor` (not yet linked from the project page)

Working files go to `grant_eval/<slug>/` (gitignored).

```bash
bun tools/autograntor/fetch.ts <slug>                 # amounts, source/application.md
bun tools/autograntor/simulate.ts <ledger.csv>        # summary per amount
bun tools/autograntor/simulate.ts --diff A.csv B.csv --size <amount>
bun tools/autograntor/publish.ts <slug> [--execute]   # dry run unless --execute (writes to prod)
```

**Changing things:** edit the prompts freely, but bump `PROMPT_VERSION` in `lib.ts` (it also covers `SKILL.md`). Re-export
`milestones.md` from the sheet when values change and bump `MILESTONES_VERSION`. Every saved run records both, plus
the ledger it was simulated from.

## Ledger format

One CSV per estimate, one row per consequence per grant amount. Columns:

| column               | meaning                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`               | short label for the consequence (or the factor's name, for a `spread` row)                                                                                                                                                                        |
| `size`               | grant amount in dollars this row belongs to (blank for `spread` rows)                                                                                                                                                                             |
| `kind`               | `event`, `continuous`, `charge` or `spread`                                                                                                                                                                                                       |
| `weight`, `p1`, `p0` | events: points if it happens; probability by 2030 with the grant and without                                                                                                                                                                      |
| `ev`, `p10`, `p90`   | continuous and charge rows: expected points and an 80% range (optional); `spread` rows: p10, p90 of the factor                                                                                                                                    |
| `exec`               | name of the `spread` factor applied to this row (program rows only, never charges)                                                                                                                                                                |
| `exec_mode`          | leave blank (only used by the old `exec` factor)                                                                                                                                                                                                  |
| `group`              | causal path: `research`, `uptake`, `policy`, `people`, `audience` (PERCYs), `community`, `money`, `exposure` (press, scandal, partisan coding), `values` (pure signalling), `other`. A harm that mirrors a positive row goes in that row's group. |
| `post2030`           | fraction (0–1) of the row's value that comes from effects after 2030                                                                                                                                                                              |
| `years`              | how many years from now the row's value mostly lands; discounted at 20% a year (`DISCOUNT_RATE` in `simulate.ts`)                                                                                                                                 |
| `note`               | free text, quoted if it has commas                                                                                                                                                                                                                |

Lines starting with `#` are ignored.

Ledgers from prompt v0–v1 used an `exec` row instead: a beta factor with mean below 1 (`ev`, `p10`, `p90` all
between 0 and 1) that discounted its rows, with `exec_mode` `credit` (multiply the points) or `p1` (multiply p1). The
simulator still reads them. It was dropped because estimators shifted doubt between the factor and the probabilities.

```csv
name,size,kind,weight,p1,p0,ev,p10,p90,exec,exec_mode,group,post2030,years,note
team,,spread,,,,,0.3,1.6,,,,,,"first-time team: could go well or badly"
eval paper adopted by a lab,10000,event,500,0.1,0.03,,,,team,,uptake,0.2,2,
researcher-years produced,10000,continuous,,,,12,5,20,team,,people,0,1,0.8 FTE-yr x 15 points
bad press for the field,10000,charge,,,,-10,-40,0,,,exposure,0,1,
```

**How it computes:**

- **Mean (the headline), exact:**
  - events: `weight × (p1 − p0)`
  - continuous rows and charges: `ev`
  - each then times `1.2^−years`. Ledgers without a `years` column (prompt v0–v2) aren't discounted
- **Monte Carlo quantiles (200k draws, fixed seed), descriptive only:**
  - each `spread` factor is one lognormal draw per world with mean 1, shared by all its rows, so they succeed or fail
    together; it multiplies their points and never changes a mean
  - each event uses one uniform draw for both the with-grant and without-grant cases
  - continuous and charge rows are lognormal when p10 and p90 have the same sign, normal when the range straddles zero
  - each row is then scaled so its mean is exactly `ev`
- **post2030 share:** Σ(row mean × post2030) / mean
- **The `--diff` agreement test:** the means are within 30% of the larger (or both within 50 points of zero), the
  largest group is the same, and no group differs by more than 30% of the larger mean.

**Not yet implemented** (Scott's simulate.py has them): `pivotal`, `--corr` (correlations beyond the execution
factor), and values-question branches with their corners.
