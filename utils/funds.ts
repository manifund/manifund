// Funds live at /funds/<slug> (F1). The slug is the fund's username, less a trailing "-fund":
// @sunlight-fund is at /funds/sunlight.
const SUFFIX = '-fund'

export function fundSlug(username: string) {
  return username.endsWith(SUFFIX) && username.length > SUFFIX.length
    ? username.slice(0, -SUFFIX.length)
    : username
}

export function fundPath(username: string) {
  return `/funds/${fundSlug(username)}`
}

// The usernames a /funds/<slug> address could mean, the shorter first.
export function fundUsernamesForSlug(slug: string) {
  return slug.endsWith(SUFFIX) ? [slug] : [slug, `${slug}${SUFFIX}`]
}
