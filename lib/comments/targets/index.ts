import type { Target, TargetRules } from '../types'
import { projectRules } from './project'
import { profileRules } from './profile'
import { causeRules } from './cause'

// The one place that maps a target to its rules. Profiles and causes join here (steps 5-6).
export function rulesFor(target: Target): TargetRules<any> {
  if ('project' in target && target.project) return projectRules
  if ('profile_id' in target && target.profile_id) return profileRules
  if ('cause_slug' in target && target.cause_slug) return causeRules
  throw new Error(`comments: unknown target ${JSON.stringify(target)}`)
}

// The target a stored comment belongs to (the one non-null target column).
export function targetOf(comment: {
  project: string | null
  profile_id: string | null
  cause_slug: string | null
}): Target {
  if (comment.project) return { project: comment.project }
  if (comment.profile_id) return { profile_id: comment.profile_id }
  if (comment.cause_slug) return { cause_slug: comment.cause_slug }
  throw new Error('comments: comment without a target')
}

// Parse a target from untrusted input: exactly one known key with a string value.
export function parseTarget(input: unknown): Target | null {
  if (!input || typeof input !== 'object') return null
  const entries = Object.entries(input as Record<string, unknown>)
  if (entries.length !== 1) return null
  const [key, value] = entries[0]
  if (typeof value !== 'string' || !value) return null
  if (key === 'project') return { project: value }
  if (key === 'profile_id') return { profile_id: value }
  if (key === 'cause_slug') return { cause_slug: value }
  return null
}
