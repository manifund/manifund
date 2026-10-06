'use client'
import { FullProject } from '@/db/project'
import { getAmountRaised, getMinIncludingAmm } from '@/utils/math'
import Link from 'next/link'
import { StageIcon } from '@/components/tags'
import { orderBy } from 'es-toolkit'
import { Table, TableRow } from '@/components/table'
import { Tooltip } from '@/components/tooltip'

// TODO: use full project and display amount raised, valuation, etc.
export function Projects(props: { projects: FullProject[] }) {
  const { projects } = props
  const sortedProjects = orderBy(projects, ['created_at'], ['desc'])

  return (
    <div>
      <h1 className="mb-2 text-xl font-medium sm:text-2xl">Projects</h1>
      <Table>
        {projects.length == 0 ? (
          <NoProjects />
        ) : (
          sortedProjects.map((project) => (
            <TableRow
              key={project.id}
              title={project.title}
              subtitle={<NextStep project={project} />}
              href={`/projects/${project.slug}`}
              tag={
                <Tooltip text={project.stage}>
                  <StageIcon stage={project.stage} className="h-5 w-5 text-gray-600" />
                </Tooltip>
              }
            />
          ))
        )}
      </Table>
    </div>
  )
}

function NoProjects() {
  return (
    <div className="p-4">
      No projects found. Would you like to{' '}
      <Link className="text-orange-600 hover:text-orange-500" href="/create">
        propose one?
      </Link>
    </div>
  )
}

function NextStep(props: { project: FullProject }) {
  const { project } = props
  // Manifund only reviews a grant once offers reach its minimum, so below it the project is simply unfunded.
  const reachedMin =
    getAmountRaised(project, project.bids, project.txns) >= getMinIncludingAmm(project)
  if (project.stage === 'proposal' && !reachedMin) {
    return <p>unfunded</p>
  }
  if (project.stage === 'proposal' && !project.signed_agreement && project.type === 'grant') {
    return (
      <Link
        href={`/projects/${project.slug}/agreement`}
        className="truncate text-xs font-normal text-gray-500 hover:underline"
      >
        pending grant agreement signature
      </Link>
    )
  }
  if (project.stage === 'proposal' && project.type === 'grant' && !project.approved) {
    return <p>pending admin approval</p>
  } else if (project.stage === 'draft') {
    return (
      <Link
        href={`/projects/${project.slug}/publish`}
        className="truncate text-xs font-normal text-gray-500 hover:underline"
      >
        pending publishing
      </Link>
    )
  } else {
    return null
  }
}
