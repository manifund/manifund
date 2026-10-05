// Where a comment lives on the site, and what it's about. Client-safe (no server imports).
// Queries that need these embed TARGET_EMBEDS; each target adds its case here.

export const TARGET_EMBEDS =
  'projects(id, title, slug, stage), target_profile:profiles!comments_profile_id_fkey(id, username, full_name)'

export type TargetEmbeds = {
  projects?: { id?: string; title: string; slug: string; stage?: string } | null
  target_profile?: { id?: string; username: string; full_name: string } | null
}

export function commentHref(comment: { id: string } & TargetEmbeds) {
  if (comment.projects) return `/projects/${comment.projects.slug}?tab=comments#${comment.id}`
  if (comment.target_profile) return `/${comment.target_profile.username}#${comment.id}`
  return '/'
}

// "Project title", "Maya Reyes's profile"
export function targetTitle(comment: TargetEmbeds) {
  if (comment.projects) return comment.projects.title
  if (comment.target_profile) {
    return `${comment.target_profile.full_name || comment.target_profile.username}'s profile`
  }
  return ''
}

// Hidden projects' comments stay out of feeds and lists (as before).
export const isListed = (comment: TargetEmbeds & { project?: string | null }) =>
  !comment.project || (!!comment.projects && comment.projects.stage !== 'hidden')
