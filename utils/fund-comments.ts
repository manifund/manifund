const DAY_MS = 24 * 60 * 60 * 1000

type MatchableComment = {
  commenter: string
  created_at: string
  replying_to: string | null
  deleted_at: string | null
  held_at: string | null
}

// F11: nothing links a comment to a fund's grant, so the fund's comment on a project is the first
// top-level comment by one of its admins from a day before the fund's first offer or donation there.
export function findFundComment<C extends MatchableComment>(
  comments: C[],
  adminIds: string[],
  firstGiftAt: string
) {
  const from = new Date(firstGiftAt).getTime() - DAY_MS
  return comments
    .filter(
      (comment) =>
        adminIds.includes(comment.commenter) &&
        !comment.replying_to &&
        !comment.deleted_at &&
        !comment.held_at &&
        new Date(comment.created_at).getTime() >= from
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
}
