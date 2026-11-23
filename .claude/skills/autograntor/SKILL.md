---
name: autograntor
description: Score one Manifund proposal with the autograntor (expected utility in milestone points at its minimum, goal and $10k), with two independent estimators, a debate when they diverge, and a final ledger saved to the project's public autograntor page. Use when asked to run the autograntor on a project slug or URL.
---

# Autograntor

Score one proposal. Argument: a project slug (or a manifund.org/projects/<slug> URL). You are the coordinator. Everything lives in
`tools/autograntor/` (see its README), and working files go in `grant_eval/<slug>/`, which is gitignored. Use
`~/.bun/bin/bun` because bun isn't on the PATH.

Keep the run cheap. Cost scales with the number of model calls, so:

- Issue independent tool calls in parallel: both estimators in one step, both critiques in one step.
- Don't re-read files you have already read.
- Don't narrate between tool calls.
- Coordinator target: about 15 calls.

## 1. Stage

Run `~/.bun/bin/bun tools/autograntor/fetch.ts <slug>`.

It prints the AI score, stage and number of earlier runs; mention them to the user, but carry on. Then read `grant_eval/<slug>/source/application.md` yourself.

## 2. Two independent estimates (in parallel, one step)

Start two Agent subagents (general-purpose) in the same message:

- **Estimator A** with model `opus`
- **Estimator B** with model `fable`

Each prompt is `tools/autograntor/prompts/estimator.md`, sent verbatim with `<slug>` filled in. Append one line:
"You are estimator A" or "You are estimator B" (X = A or B). Don't add your own views of the proposal, which
would break independence.

When both reply, run:

```
~/.bun/bin/bun tools/autograntor/simulate.ts --diff grant_eval/<slug>/A_ledger.csv grant_eval/<slug>/B_ledger.csv --size <smallest amount>
```

If an estimator didn't produce a valid ledger, send it the simulator's error with SendMessage once.

## 3. Debate, only on DIVERGE

- **DIVERGE:** continue both estimators with SendMessage, in the same step. Each gets `prompts/critique.md` plus the
  diff output. A critiques B (`critique_of_B.md`) and B critiques A (`critique_of_A.md`).
- **AGREE:** skip this step and say so in the report.

## 4. Final ledger and report

Read both estimates, both ledgers and any critiques in one step. Follow `tools/autograntor/prompts/report.md`:

1. Write `final_ledger.csv` and simulate it.
2. Fix it once if the simulator flags something.
3. Write `report.md` once.

## 5. Publish

1. Run `~/.bun/bin/bun tools/autograntor/publish.ts <slug>`, a dry run that re-simulates `final_ledger.csv`. If it
   refuses or its numbers don't match the report, fix that first.
2. Then run it again with `--execute` straight away; don't wait for the user's OK. This writes to production.
3. Show the user the simulator's summary table, the three decisions that mattered most, and the link it prints.

Report anything that went wrong along the way: an estimator far over its call target, a failed fetch, a fact an
estimator flagged as wrong.
