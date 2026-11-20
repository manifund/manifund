// Stages a proposal for an autograntor run: works out the amounts (P15) and writes
// grant_eval/<slug>/source/application.md for the estimators.
//
//   bun tools/autograntor/fetch.ts <slug>

import { mkdir } from 'fs/promises'
import path from 'path'
import { createAdminClient } from '@/db/edge'
import { toMarkdown } from '@/utils/tiptap-parsing'
import { MILESTONES_VERSION, PROMPT_VERSION, grantAmounts, runDir } from '@/tools/autograntor/lib'

const args = process.argv.slice(2)
const slug = args.find((a) => !a.startsWith('--'))
if (!slug) {
  console.error('Usage: bun tools/autograntor/fetch.ts <slug>')
  process.exit(1)
}

const supabase = createAdminClient()
const { data: project } = await supabase
  .from('projects')
  .select(
    'id, slug, title, blurb, description, created_at, stage, type, min_funding, funding_goal, profiles!projects_creator_fkey(full_name, username, bio, website)'
  )
  .eq('slug', slug)
  .maybeSingle()
  .throwOnError()
if (!project) {
  console.error(`No project with slug "${slug}"`)
  process.exit(1)
}

const [{ data: aiEval }, { data: prior }] = await Promise.all([
  supabase
    .from('project_ai_evals')
    .select('score, created_at')
    .eq('project_id', project.id)
    .not('score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError(),
  supabase
    .from('project_autograntor_evals')
    .select('id, created_at')
    .eq('project_id', project.id)
    .throwOnError(),
])

const amounts = grantAmounts(project.min_funding, project.funding_goal)
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
const creator = project.profiles
const application = [
  `# ${project.title}`,
  '',
  `- URL: https://manifund.org/projects/${project.slug}`,
  `- Posted: ${project.created_at.slice(0, 10)}`,
  `- Creator: ${creator?.full_name ?? ''} (username: ${creator?.username ?? ''})${creator?.website ? `, ${creator.website}` : ''}`,
  creator?.bio ? `- Creator bio: ${creator.bio}` : null,
  `- Minimum funding: ${usd(project.min_funding)}`,
  `- Funding goal: ${usd(project.funding_goal)}`,
  `- **Amounts to score: ${amounts.map(usd).join(', ')}**`,
  '',
  project.blurb ? `> ${project.blurb}` : null,
  '',
  project.description ? toMarkdown(project.description as any) : '',
]
  .filter((l) => l !== null)
  .join('\n')

const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(application))
const contentHash = Buffer.from(digest).toString('hex')

const dir = runDir(slug)
await mkdir(path.join(dir, 'source'), { recursive: true })
await Bun.write(path.join(dir, 'source', 'application.md'), application)
await Bun.write(
  path.join(dir, 'run.json'),
  JSON.stringify(
    {
      slug,
      project_id: project.id,
      amounts,
      content_hash: contentHash,
      prompt_version: PROMPT_VERSION,
      milestones_version: MILESTONES_VERSION,
      ai_score: aiEval?.score ?? null,
      started_at: new Date().toISOString(),
    },
    null,
    2
  )
)

console.log(`Staged ${project.title} in ${path.relative(process.cwd(), dir)}/`)
console.log(
  `AI score ${aiEval?.score ?? 'none'} | stage ${project.stage} | earlier autograntor runs: ${prior?.length ?? 0}`
)
console.log(`amounts ${amounts.map(usd).join(', ')}`)
console.log(`prompt ${PROMPT_VERSION} | ${MILESTONES_VERSION}`)
