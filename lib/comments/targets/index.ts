import type { Target, TargetRules } from '../types'
import { projectRules } from './project'
import { profileRules } from './profile'
import { orgRules } from './org'

// The one place that maps a target to its rules.
export function rulesFor(target: Target): TargetRules<any> {
  if ('project' in target && target.project) return projectRules
  if ('profile_id' in target && target.profile_id) return profileRules
  if ('org_id' in target && target.org_id) return orgRules
  throw new Error(`comments: unknown target ${JSON.stringify(target)}`)
}

// The target a stored comment belongs to (the one non-null target column).
export function targetOf(comment: {
  project: string | null
  profile_id: string | null
  org_id?: string | null
}): Target {
  if (comment.project) return { project: comment.project }
  if (comment.profile_id) return { profile_id: comment.profile_id }
  if (comment.org_id) return { org_id: comment.org_id }
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
  if (key === 'org_id') return { org_id: value }
  return null
}
