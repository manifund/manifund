# Autograntor

Estimates the utility of funding a Manifund proposal, in milestone points: a Plan A US–China pause = 1,000,000
(`milestones.md`, Caroline's values). It scores the minimum, the goal, and $10k if $10k falls between them. Modeled on
Scott Alexander's autograntor, simplified: no Common Law, and this folder's own ledger simulator. Rules P14–P17 in
`docs/product/projects/README.md`.

Run it from Claude Code in the repo: `/autograntor <slug>` (`.claude/skills/autograntor/SKILL.md`). The skill:

1. stages the proposal with `fetch.ts`
2. runs two independent estimators (Opus and Fable) with `prompts/estimator.md`
3. compares their ledgers, with a critique round only if they diverge (`prompts/critique.md`)
4. writes a final ledger and report (`prompts/report.md`)
5. saves them with `publish.ts` to `project_autograntor_evals`, shown to admins at `/projects/<slug>/autograntor`

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
| `name`               | short label for the consequence (or the execution factor's name, for an `exec` row)                                                                                                                                                               |
| `size`               | grant amount in dollars this row belongs to (blank for `exec` rows)                                                                                                                                                                               |
| `kind`               | `event`, `continuous`, `charge` or `exec`                                                                                                                                                                                                         |
| `weight`, `p1`, `p0` | events: points if it happens; probability by 2030 with the grant and without                                                                                                                                                                      |
| `ev`, `p10`, `p90`   | continuous and charge rows: expected points and an 80% range (optional); `exec` rows: mean, p10, p90 of the factor                                                                                                                                |
| `exec`               | name of the execution factor applied to this row (program rows only, never charges)                                                                                                                                                               |
| `exec_mode`          | events with an execution factor: `credit` if p0 is the chance this same work happens anyway, `p1` if p0 is a base rate from other causes                                                                                                          |
| `group`              | causal path: `research`, `uptake`, `policy`, `people`, `audience` (PERCYs), `community`, `money`, `exposure` (press, scandal, partisan coding), `values` (pure signalling), `other`. A harm that mirrors a positive row goes in that row's group. |
| `post2030`           | fraction (0–1) of the row's value that comes from effects after 2030                                                                                                                                                                              |
| `note`               | free text, quoted if it has commas                                                                                                                                                                                                                |

Lines starting with `#` are ignored.

```csv
name,size,kind,weight,p1,p0,ev,p10,p90,exec,exec_mode,group,post2030,note
team,,exec,,,,0.6,0.3,0.85,,,,,"execution: first-time team, strong advisors"
eval paper adopted by a lab,10000,event,500,0.15,0.05,,,,team,credit,uptake,0.2,
researcher-years produced,10000,continuous,,,,12,5,20,team,,people,0,0.8 FTE-yr x 15 points
bad press for the field,10000,charge,,,,-10,-40,0,,,exposure,0,
```

**How it computes:**

- **Mean (the headline), exact:**
  - events: `weight × (p1 − p0)`, times E[x] in `credit` mode, or `weight × (E[x]·p1 − p0)` in `p1` mode
  - continuous rows: `ev × E[x]`
  - charges: `ev`
- **Monte Carlo quantiles (200k draws, fixed seed), descriptive only:**
  - each execution factor is one beta draw per world, shared by all its rows, so they succeed or fail together
  - each event uses one uniform draw for both the with-grant and without-grant cases
  - continuous and charge rows are lognormal when p10 and p90 have the same sign, normal when the range straddles zero
  - each row is then scaled so its mean is exactly `ev`
- **post2030 share:** Σ(row mean × post2030) / mean
- **The `--diff` agreement test:** the means are within 30% of the larger (or both within 50 points of zero), the
  largest group is the same, and no group differs by more than 30% of the larger mean.

**Not yet implemented** (Scott's simulate.py has them): `pivotal`, `--corr` (correlations beyond the execution
factor), and values-question branches with their corners.
