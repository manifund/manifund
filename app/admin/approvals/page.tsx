import { createAdminClient } from '@/db/edge'
import { GrantVerdict } from '../grant-verdict'
import { PauseAlertsButton } from '../pause-alerts-button'
import Link from 'next/link'
import clsx from 'clsx'
import { Table } from '@/components/table-catalyst'
import { requireAdmin } from '@/lib/require-admin'

export default async function ApprovalsPage() {
  await requireAdmin() // before any admin-client read: the layout's check alone doesn't stop the page
  const supabaseAdmin = createAdminClient()
  // Instead of using listProjects, only fetch the fields out of the projects that we need
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select(
      'id, title, slug, stage, approved, min_funding, lobbying, signed_agreement, alerts_paused, profiles!projects_creator_fkey(username, full_name), bids(amount, type)'
    )
    .eq('stage', 'proposal')
    .order('created_at', { ascending: false })
    .throwOnError()

  const projectsToApprove =
    projects?.filter(
      (project) =>
        project.stage === 'proposal' &&
        project.approved === null &&
        project.bids.reduce(
          (acc, bid) =>
            bid.type === 'assurance buy' || bid.type === 'donate' ? acc + bid.amount : acc,
          0
        ) >= project.min_funding
    ) ?? []

  return (
    <Table>
      <thead>
        <tr>
          <th className="p-2 text-center">Creator</th>
          <th className="p-2 text-center">Project</th>
          <th className="p-2 text-center">Alerts</th>
          <th className="p-2 text-center">Grant verdict</th>
        </tr>
      </thead>
      <tbody className="p-2">
        {projectsToApprove.map((project) => (
          <tr key={project.id} className={clsx(project.alerts_paused && 'opacity-60')}>
            <td>
              <Link href={`/${project.profiles?.username}`}>{project.profiles?.full_name}</Link>
            </td>
            <td>
              <Link
                href={`/projects/${project.slug}`}
                className={clsx(project.signed_agreement ? 'text-gray-900' : 'text-rose-600')}
              >
                {project.title}
              </Link>
            </td>
            <td>
              <PauseAlertsButton projectId={project.id} alertsPaused={project.alerts_paused} />
            </td>
            <td>
              <GrantVerdict projectId={project.id} lobbying={project.lobbying} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
