import path from 'path'

// Bump PROMPT_VERSION when anything in prompts/ or SKILL.md changes, MILESTONES_VERSION when milestones.md does.
export const PROMPT_VERSION = 'v0'
export const MILESTONES_VERSION = 'milestones-2026-11-20'
export const MID_AMOUNT = 10_000

export const TOOL_DIR = import.meta.dir
export const RUNS_DIR = path.join(TOOL_DIR, '..', '..', 'grant_eval')
export const runDir = (slug: string) => path.join(RUNS_DIR, slug)

// P19: the minimum, the goal, and $10k when it lies strictly between them.
export function grantAmounts(minFunding: number, fundingGoal: number): number[] {
  const amounts = new Set([minFunding, Math.max(minFunding, fundingGoal)])
  if (minFunding < MID_AMOUNT && MID_AMOUNT < fundingGoal) amounts.add(MID_AMOUNT)
  return [...amounts].filter((a) => a > 0).sort((a, b) => a - b)
}
