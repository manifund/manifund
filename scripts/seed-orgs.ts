// Upserts scripts/orgs-seed.ts into public.orgs, by slug. Safe to re-run.
//   bun scripts/seed-orgs.ts            (writes to the database in .env: production by default)
//   bun scripts/seed-orgs.ts --dry-run  (prints what it would write)
import { createAdminClient } from '@/db/supabase-admin'
import { ORGS } from './orgs-seed'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const supabase = createAdminClient()
  // One request per org: a batch would null every column that some other org sets and this one doesn't.
  for (const org of ORGS) {
    if (dryRun) {
      console.log(org)
      continue
    }
    const { error } = await supabase
      .from('orgs')
      .upsert({ ...org, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    console.log(error ? `FAILED ${org.slug}: ${error.message}` : `ok ${org.slug}`)
    if (error) process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
