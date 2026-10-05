// Pure (no server-only imports), so unit tests can import it.
import { REASONS, type Recipient } from '@/lib/comments/types'

// One notification per person per comment: when several reasons apply, the earliest in REASONS
// wins; an email covered elsewhere stays covered even if a stronger reason wins; the actor never
// notifies themselves. Pure, for tests (C21).
export function pickRecipients(recipients: Recipient[], actorId: string): Recipient[] {
  const best = new Map<string, Recipient>()
  for (const r of recipients) {
    if (!r.id || r.id === actorId) continue
    const current = best.get(r.id)
    if (!current || REASONS.indexOf(r.reason) < REASONS.indexOf(current.reason)) {
      best.set(r.id, { ...r, email: (r.email ?? true) && (current?.email ?? true) })
    } else if (r.email === false) {
      best.set(r.id, { ...current, email: false })
    }
  }
  return [...best.values()]
}
