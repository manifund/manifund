import { FullProject } from '@/db/project'
import { aiRankingScore, KARMA_CONFIG } from '@/utils/karma'
import { getAmountRaised } from '@/utils/math'
import { isSlopProject } from '@/utils/slop'

// Which projects the weekly digest shows, in two sections: highly rated proposals still short of
// their minimum, then the week's new projects.
export const DIGEST_PROJECT_RULES = {
  // New this week: karma plus the homepage's AI head start must be above this
  newMinValue: 3,
  newLimit: 7,
  highlyRatedMinScore: 4,
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const votes = (p: FullProject) => p.project_votes.reduce((sum, v) => sum + v.magnitude, 0)

// Proposals close at the end of their closing date, Pacific time (see close-grants)
export const closesAt = (p: FullProject) =>
  p.auction_close ? new Date(`${p.auction_close}T23:59:59-07:00`).getTime() : null

export function newProjectValue(p: FullProject) {
  return (p.karma ?? 0) + (KARMA_CONFIG.aiScoreBoost[aiRankingScore(p.project_ai_evals) ?? 0] ?? 0)
}

export function selectNewProjects(
  projects: FullProject[],
  now: number,
  excludeIds = new Set<string>()
) {
  return projects
    .filter(
      (p) =>
        new Date(p.created_at).getTime() >= now - WEEK_MS &&
        !excludeIds.has(p.id) &&
        !isSlopProject(p) &&
        newProjectValue(p) > DIGEST_PROJECT_RULES.newMinValue
    )
    .sort(
      (a, b) =>
        newProjectValue(b) - newProjectValue(a) ||
        votes(b) - votes(a) ||
        b.created_at.localeCompare(a.created_at)
    )
    .slice(0, DIGEST_PROJECT_RULES.newLimit)
}

// A proposal rated 4-5 that's below its minimum is shown twice: the week it first qualifies
// (its first 4+ evaluation) and the week before it closes.
export function isHighlyRatedStillRaising(p: FullProject, now: number) {
  if (p.stage !== 'proposal') return false
  if ((aiRankingScore(p.project_ai_evals) ?? 0) < DIGEST_PROJECT_RULES.highlyRatedMinScore)
    return false
  if (getAmountRaised(p, p.bids, p.txns) >= p.min_funding) return false
  const firstHigh = (p.project_ai_evals ?? [])
    .filter((e) => (e.score ?? 0) >= DIGEST_PROJECT_RULES.highlyRatedMinScore)
    .map((e) => new Date(e.created_at).getTime())
    .sort((a, b) => a - b)[0]
  const close = closesAt(p)
  const firstWeek = firstHigh !== undefined && firstHigh >= now - WEEK_MS
  const lastWeek = close !== null && close > now && close <= now + WEEK_MS
  return firstWeek || lastWeek
}

export function selectHighlyRatedStillRaising(projects: FullProject[], now: number) {
  return projects
    .filter((p) => isHighlyRatedStillRaising(p, now))
    .sort((a, b) => (closesAt(a) ?? Infinity) - (closesAt(b) ?? Infinity))
}
