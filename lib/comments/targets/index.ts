import type { Target, TargetRules } from '../types'
import { projectRules } from './project'

// The one place that maps a target to its rules. Profiles and causes join here (steps 5-6).
export function rulesFor(target: Target): TargetRules<any> {
  if ('project' in target && target.project) return projectRules
  throw new Error(`comments: unknown target ${JSON.stringify(target)}`)
}

// The target a stored comment belongs to (the one non-null target column).
export function targetOf(comment: { project: string | null }): Target {
  if (comment.project) return { project: comment.project }
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
  return null
}
