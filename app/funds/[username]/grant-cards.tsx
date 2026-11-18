import { ProjectCard } from '@/components/project-card'
import { formatMoney } from '@/utils/formatting'
import { FullProject } from '@/db/project'

export type GrantAmount = { granted: number; offered: number; latest: string }

// Like ProjectGroup, with a band above each card saying what the fund gave or offered (F5)
export function GrantCards(props: {
  projects: FullProject[]
  amounts: Record<string, GrantAmount>
}) {
  const { projects, amounts } = props
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 font-normal">
      {projects.map((project) => {
        const { granted, offered } = amounts[project.id]
        return (
          <div key={project.id} className="flex flex-col">
            <div className="w-fit rounded-t-md bg-amber-100 px-2.5 py-1 text-sm font-light text-amber-950">
              {granted > 0 && (
                <>
                  <span className="font-medium">{formatMoney(granted)}</span> granted
                </>
              )}
              {granted > 0 && offered > 0 && ', '}
              {offered > 0 && (
                <>
                  <span className="font-medium">{formatMoney(offered)}</span> offered, pending
                </>
              )}
            </div>
            <div className="flex-1 [&>*]:h-full [&>*]:rounded-tl-none">
              <ProjectCard project={project} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
