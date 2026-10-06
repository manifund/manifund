import { ProjectCard } from 'manifund'
import { project, activeProject } from '../mocks'

export const Proposal = () => (
  <div className="w-96 bg-gray-50 p-4">
    <ProjectCard project={project} />
  </div>
)

export const Active = () => (
  <div className="w-96 bg-gray-50 p-4">
    <ProjectCard project={activeProject} />
  </div>
)
