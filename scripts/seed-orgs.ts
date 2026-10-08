// Upserts scripts/orgs-seed.ts into public.orgs, by slug, and links each org's projects (public.org_projects).
// Safe to re-run. It only adds links: to unlink a project, delete its row.
//   bun scripts/seed-orgs.ts            (writes to the database in .env: production by default)
//   bun scripts/seed-orgs.ts --dry-run  (prints what it would write)
import { createAdminClient } from '@/db/supabase-admin'
import { ORGS, ORG_PROJECTS } from './orgs-seed'

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

  for (const [orgSlug, projectSlugs] of Object.entries(ORG_PROJECTS)) {
    const { data: org } = await supabase.from('orgs').select('id').eq('slug', orgSlug).maybeSingle()
    const { data: projects } = await supabase
      .from('projects')
      .select('id, slug')
      .in('slug', projectSlugs)
    const missing = projectSlugs.filter((slug) => !projects?.some((p) => p.slug === slug))
    if (!org || missing.length > 0) {
      console.log(
        `FAILED ${orgSlug} projects: ${org ? `no project ${missing.join(', ')}` : 'no such org'}`
      )
      process.exitCode = 1
      continue
    }
    if (dryRun) {
      console.log(orgSlug, projectSlugs)
      continue
    }
    const { error } = await supabase.from('org_projects').upsert(
      (projects ?? []).map((project) => ({ project_id: project.id, org_id: org.id })),
      { onConflict: 'project_id' }
    )
    console.log(error ? `FAILED ${orgSlug} projects: ${error.message}` : `ok ${orgSlug} projects`)
    if (error) process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
