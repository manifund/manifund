import { KARMA_CONFIG, karmaWeight } from '@/utils/karma'

// Which of a week's comments the weekly digest highlights. A comment scores the karma weight of
// everyone who reacted positively to it (as in karma), plus half its author's karma weight.
export const NOTABLE_COMMENT_RULES = {
  minScore: 1,
  // Unreacted comments shorter than this are usually thanks or quick replies
  minLength: 100,
  authorWeight: 0.5,
  limit: 15,
}

export type ScorableComment = {
  commenter: string
  commenterKarma: number
  replyingTo: string | null
  specialType: string | null
  textLength: number
  reactions: { reactorId: string; reactorKarma: number; reaction: string; tipped: boolean }[]
}

export function notableCommentScore(c: ScorableComment): number | null {
  // Replies and admin verdict notes (approvals, rejections) are never highlighted
  if (c.replyingTo || c.specialType === 'admin note') return null
  const positive = new Set(KARMA_CONFIG.positiveReacts)
  const reacts = c.reactions
    .filter(
      (r) =>
        r.reactorId !== c.commenter &&
        (positive.has(r.reaction) || r.reaction in KARMA_CONFIG.tippedReactMultipliers)
    )
    .reduce(
      (sum, r) =>
        sum +
        karmaWeight(r.reactorKarma) *
          (r.tipped ? (KARMA_CONFIG.tippedReactMultipliers[r.reaction] ?? 1) : 1),
      0
    )
  if (reacts === 0 && c.textLength < NOTABLE_COMMENT_RULES.minLength) return null
  const score = reacts + NOTABLE_COMMENT_RULES.authorWeight * karmaWeight(c.commenterKarma)
  return score >= NOTABLE_COMMENT_RULES.minScore ? score : null
}
