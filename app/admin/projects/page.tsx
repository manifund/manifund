import { createAdminClient } from '@/db/edge'
import { listProjects } from '@/db/project'
import { ProjectTable, ProjectRow } from './project-table'
import { requireAdmin } from '@/lib/require-admin'

export default async function ProjectsPage() {
  await requireAdmin() // before any admin-client read: the layout's check alone doesn't stop the page
  const supabaseAdmin = createAdminClient()
  const projects = await listProjects(supabaseAdmin)

  const rows: ProjectRow[] = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    username: project.profiles?.username ?? null,
    minFunding: project.min_funding,
    stage: project.stage,
  }))

  return <ProjectTable projects={rows} />
}
