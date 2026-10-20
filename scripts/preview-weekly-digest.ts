import { writeFileSync } from 'fs'
import { createAdminClient } from '@/db/edge'
import {
  getHighlyRatedStillRaising,
  getNewProjectsLastWeek,
  getNotableCommentsLastWeek,
  getNotableGrantsLastWeek,
  generateHtmlDigest,
} from '../utils/weekly-digest'

async function previewWeeklyDigest() {
  const supabase = createAdminClient()

  const highlyRated = await getHighlyRatedStillRaising(supabase)
  const [projects, notableComments, notableGrants] = await Promise.all([
    getNewProjectsLastWeek(supabase, new Set(highlyRated.map((p) => p.id))),
    getNotableCommentsLastWeek(supabase),
    getNotableGrantsLastWeek(supabase, 15),
  ])

  console.log(
    `Found ${highlyRated.length} highly rated, ${projects.length} new projects, ${notableComments.length} comments, ${notableGrants.length} grants`
  )

  const html = generateHtmlDigest(projects, notableComments, notableGrants, highlyRated)
  const outPath = '/tmp/digest-preview.html'
  writeFileSync(outPath, html)
  console.log(`Wrote preview to ${outPath}`)
}

void previewWeeklyDigest()
