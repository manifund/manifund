// Reviews Trace collected from comments on Manifund projects: who wrote them, and their text without
// the line Trace puts first. Plain functions, shared by the page (server) and the list (browser).

// The Manifund username behind a reviewer's link, or null when the review is from somewhere else.
export function manifundUsername(reviewerUrl: string | null) {
  const match = reviewerUrl?.match(/^https?:\/\/(?:www\.)?manifund\.org\/([^/?#]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

const SOURCE_LINE = /^\[([^\]]*)\]\((https?:\/\/[^)\s]+)\), [A-Z][a-z]{2} \d{4}\n+/

// Trace joins a person's comments about an org with a rule between them, each starting
// "[Project title](link), Mon 2025". Gives the text alone, and the first comment's project.
export function splitManifundReview(body: string) {
  const comments = body.split(/\n+---\n+/)
  const first = comments[0].match(SOURCE_LINE)
  return {
    project: first ? { title: first[1].trim(), href: first[2] } : null,
    text: comments.map((comment) => comment.replace(SOURCE_LINE, '').trim()).join('\n\n'),
  }
}
