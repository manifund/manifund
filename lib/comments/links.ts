// Where a comment lives on the site, and what it's about. Client-safe (no server imports).
// Queries that need these embed TARGET_EMBEDS; each target adds its case here.

export const TARGET_EMBEDS =
  'projects(id, title, slug, stage), target_profile:profiles!comments_profile_id_fkey(id, username, full_name), target_org:orgs(id, slug, name)'

export type TargetEmbeds = {
  projects?: { id?: string; title: string; slug: string; stage?: string } | null
  target_profile?: { id?: string; username: string; full_name: string } | null
  target_org?: { id?: string; slug: string; name: string } | null
}

export function commentHref(comment: { id: string } & TargetEmbeds) {
  if (comment.projects) return `/projects/${comment.projects.slug}?tab=comments#${comment.id}`
  if (comment.target_profile) return `/${comment.target_profile.username}#${comment.id}`
  if (comment.target_org) return `/orgs/${comment.target_org.slug}#${comment.id}`
  return '/'
}

// "Project title", "Maya Reyes's profile", "METR"
export function targetTitle(comment: TargetEmbeds) {
  if (comment.projects) return comment.projects.title
  if (comment.target_profile) {
    return `${comment.target_profile.full_name || comment.target_profile.username}'s profile`
  }
  if (comment.target_org) return comment.target_org.name
  return ''
}

// Hidden projects' comments stay out of feeds and lists (as before).
export const isListed = (comment: TargetEmbeds & { project?: string | null }) =>
  !comment.project || (!!comment.projects && comment.projects.stage !== 'hidden')
