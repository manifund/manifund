# Proposal eval

Research tooling for an AI judge of Manifund proposals created on or after 2026-07-01 (after the model's training cutoff). For each project, Claude gives an opinion, a 1-5 score, and P(reaches minimum funding). It never sees stage, amount raised, votes, or comments.

The winning prompt (v3a) now runs in production: `app/utils/project-ai-evals.ts` scores every new or edited project into `project_ai_evals` (rules P1-P6 in `docs/product/projects/README.md`). A prompt change there should be tested here first.

## What we found (317 closed proposals, 48 funded, as of 2026-10-15)

| Run                                                           | AUC      | Mean p  | Brier skill |
| ------------------------------------------------------------- | -------- | ------- | ----------- |
| v1: told the base rate                                        | 0.81     | 14%     | 0.20        |
| v2: v1 + "small asks aren't easier" + "substance over polish" | 0.85     | 10%     | 0.20        |
| v3b: v2 + "use the full range"                                | 0.86     | 10%     | 0.21        |
| **v3a: v2 without the base-rate sentence**                    | **0.86** | **16%** | **0.26**    |
| GPT-6.1 Sol, v3a prompt                                       | 0.85     | 34%     | -0.05       |
| Words in the proposal (TF-IDF regression)                     | 0.88     | 13%     | 0.17        |
| Claude v3a p + log min, log goal/min, log length (regression) | 0.90     | 15%     | 0.39        |

The first four rows are on the 308 closed proposals every Claude run scored; the rest are on all 317 (GPT on 318, a day later). Brier skill is how much better than always guessing the base rate (0 = no better). Regressions are scored with 20x repeated 5-fold cross-validation. Claude underrates large asks (over $20k: 11% predicted, 24% funded), which the regression corrects. Web research (v1-web) didn't beat text alone and kept finding outcomes. Cause areas were left out of the combined model on purpose: they'd teach it the current donor pool's tastes.

## Running it

- `text` mode: proposal text only. Runs through OpenRouter (`OPENROUTER_API_KEY`) by default.
- `web` mode: also web search/fetch to research the team, via the Anthropic API (`--provider anthropic`), since it relies on Anthropic's `blocked_domains` to keep manifund.org/.com out. Queries and URLs are logged in each row.

```bash
# flag proposals whose text shows funding was arranged elsewhere (results/screen.jsonl)
bun tools/proposal-eval/screen.ts

# score (resumable: rerun the same command to finish or retry errors)
bun tools/proposal-eval/run.ts --mode text --run-id v2-text --prompt v2 --skip-prearranged
bun tools/proposal-eval/run.ts --mode web --run-id v1-web --prompt v1 --provider anthropic --concurrency 5
#   --limit N, --project <slug>, --effort low|medium|high|xhigh|max, --dry-run (prints the exact prompt)

bun tools/proposal-eval/analyze.ts [--run v2-text] [--include-leaked]
bun tools/proposal-eval/sync-airtable.ts [--run v2-text]   # needs AIRTABLE_PAT
```

Results are written to `results/<run_id>.jsonl` (gitignored), one row per attempt. The latest successful row for each project is the one used. Airtable base: "Manifund AI Evals" (`appvalF5dSKjOUahH`). It has a Projects table with current outcomes and an Evals table with one row per run and project.

Prompts live in `prompts/<version>-<mode>.md`, picked with `--prompt`. `{{BASE_RATE}}` is filled from the share of closed projects that reached their minimum, over the projects being judged.

Outcome = stage: `active`/`complete` means it reached its minimum, `not funded` means it didn't, and `proposal` is still open. Calibration only uses closed projects, so rerun `analyze.ts` as open projects close. `analyze.ts` leaves out rows flagged as leaked, rows that fetched a Manifund page, and prearranged projects (screen flags plus any mention of grantmaking.ai). The grantmaking.ai rule is crude: it also drops proposals that mention a separate grantmaking.ai grant, such as IBBIS's commec proposal, which went unfunded.

Baselines and the combined model (logistic regressions on amounts, length, causes, creator history, TF-IDF of the text, and Claude's probability, cross-validated on closed projects; needs Python with scikit-learn):

```bash
bun tools/proposal-eval/baseline-export.ts [--run v3a-text]   # writes results/baseline-data.jsonl
python3 tools/proposal-eval/baseline.py                        # prints the comparison, writes results/baseline-results.json and baseline-calibration.json
```
