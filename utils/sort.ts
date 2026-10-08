import { FullProject } from '@/db/project'
import { getAmountRaised } from '@/utils/math'
import { isAcceptingDonations, projectHotScore } from '@/utils/karma'

export function pointScore(project: FullProject) {
  // Rough heuristic for how good a project is:
  // Votes are 2 points, comments are 1, every OOM raised is ~6 points
  const votes = countVotes(project)
  const comments = project.comments.length
  const raised = getAmountRaised(project, project.bids, project.txns)

  // Special: Penalize low-quality projects, usually ones that Austin
  // manually downvotes
  if (votes <= 0 && raised <= 500) {
    return -2
  }

  const points = votes * 2 + comments + Math.log(raised + 1) * 3
  return points
}

export function hotScore(project: FullProject) {
  // Hacker News newness algorithm: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
  // Note that we use days instead of hours, and modify the constants a bit

  // Time in days since project was created
  let days = Date.now() - new Date(project.created_at).getTime()
  days = days / (1000 * 60 * 60 * 24)

  const score = (pointScore(project) + 2) / days ** 1.8

  return -score
}

// Homepage sort: stored karma decayed by age. Negated so sortBy() ascending puts hottest first.
export function karmaHotScore(project: FullProject) {
  const raised = getAmountRaised(project, project.bids, project.txns)
  return -projectHotScore(project.karma, project.created_at, isAcceptingDonations(project, raised))
}

export const countVotes = (project: FullProject) =>
  project.project_votes.reduce((acc, vote) => acc + vote.magnitude, 0)
