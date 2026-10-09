// Recompute and store karma for every profile and project. Used for the initial
// backfill; the hourly cron (app/api/karma/sync) does this in production.
// Note: can't invalidate the Next.js hot-projects cache from here; it expires within the hour.
import { createAdminClient } from '@/db/edge'
import { recomputeKarma } from '@/db/karma'

async function main() {
  const summary = await recomputeKarma(createAdminClient())
  console.log(summary)
}

void main()
