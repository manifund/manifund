'use client'
import { FullProject } from '@/db/project'
import { ProjectCard } from '@/components/project-card'
import { NetworkTag } from '@/components/follows/network-tag'

export function ProjectGroup(props: { projects: FullProject[]; prices?: { [k: string]: number } }) {
  const { projects, prices } = props
  return (
    // each card takes two rows of a subgrid: the line about people you follow above it, on a tab joined to the
    // card (F8), then the card, so cards side by side start at the same height whether or not they have a line
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-2">
      {projects.map((project) => (
        <div key={project.id} className="row-span-2 grid grid-rows-subgrid gap-y-0">
          <NetworkTag projectId={project.id} />
          <ProjectCard project={project} valuation={prices ? prices[project.id] : undefined} />
        </div>
      ))}
    </div>
  )
}
