// Star ratings on org reviews are built but switched off: nothing stores a rating yet. Turning this on shows
// stars on reviews that have one, and the average on the org page and its card. Reviews without a rating
// (every one written before ratings exist) never show stars and don't count towards the average.
export const STAR_RATINGS = false

export const MAX_RATING = 5

export function averageRating(ratings: (number | null)[]) {
  const given = ratings.filter((rating): rating is number => rating !== null)
  return given.length > 0 ? given.reduce((sum, rating) => sum + rating, 0) / given.length : null
}
