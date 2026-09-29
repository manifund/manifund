// Where a comment lives on the site. Client-safe (no server imports). Each target adds its case.
export function commentHref(comment: { id: string; projects?: { slug: string } | null }) {
  if (comment.projects) return `/projects/${comment.projects.slug}?tab=comments#${comment.id}`
  return '/'
}

export function targetTitle(comment: { projects?: { title: string } | null }) {
  return comment.projects?.title ?? ''
}
