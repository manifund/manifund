'use client'
import Link from 'next/link'
import { ProjectCard } from '@/components/project-card'
import { FullProject } from '@/db/project'
import { getAmountRaised, getMinIncludingAmm } from '@/utils/math'
import { loadMoreProjects } from '../actions'
import { ShowMore, usePaged } from '../show-more'
import type { Page } from '../profile-data'

export function ProjectGrid(props: {
  profileId: string
  first: Page<FullProject>
  total: number
  isOwn: boolean
}) {
  const { profileId, first, total, isOwn } = props
  const { items, hasMore, more, pending, error } = usePaged(first, (offset) =>
    loadMoreProjects(profileId, offset)
  )
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 font-normal">
        {items.map((project) => {
          // On your own profile, what's left to do before a project can be funded
          const step = isOwn ? nextStep(project) : null
          return (
            <div key={project.id} className="flex flex-col">
              {step && (
                <div className="w-fit rounded-t-md bg-amber-100 px-2.5 py-1 text-sm font-light text-amber-950">
                  {step.href ? (
                    <Link href={step.href} className="hover:underline">
                      {step.text}
                    </Link>
                  ) : (
                    step.text
                  )}
                </div>
              )}
              <div
                className={
                  step ? 'flex-1 [&>*]:h-full [&>*]:rounded-tl-none' : 'flex-1 [&>*]:h-full'
                }
              >
                <ProjectCard project={project} />
              </div>
            </div>
          )
        })}
      </div>
      {hasMore && (
        <ShowMore
          shown={items.length}
          total={total}
          onClick={more}
          pending={pending}
          error={error}
        />
      )}
    </>
  )
}

function nextStep(project: FullProject): { text: string; href?: string } | null {
  if (project.stage === 'draft')
    return { text: 'Draft: publish it', href: `/projects/${project.slug}/publish` }
  if (project.stage === 'hidden') return { text: 'Hidden' }
  if (project.stage !== 'proposal') return null
  // Manifund only reviews a grant once offers reach its minimum, so below it the project is simply unfunded.
  const reachedMin =
    getAmountRaised(project, project.bids, project.txns) >= getMinIncludingAmm(project)
  if (!reachedMin) return null
  if (project.type === 'grant' && !project.signed_agreement)
    return { text: 'Sign the grant agreement', href: `/projects/${project.slug}/agreement` }
  if (project.type === 'grant' && !project.approved) return { text: 'Waiting for admin approval' }
  return null
}
