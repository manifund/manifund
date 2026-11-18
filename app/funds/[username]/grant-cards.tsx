import Link from 'next/link'
import clsx from 'clsx'
import { ProjectCard } from '@/components/project-card'
import { Avatar } from '@/components/avatar'
import { formatMoney } from '@/utils/formatting'
import { FullProject } from '@/db/project'

export type GrantAmount = { granted: number; offered: number; latest: string }
export type GrantComment = {
  href: string
  author: { id: string; username: string; full_name: string; avatar_url: string | null }
}

// Like ProjectGroup, with a band above each card saying what the fund gave or offered (F5),
// and below it a link to the admin's comment on the grant (F11).
export function GrantCards(props: {
  projects: FullProject[]
  amounts: Record<string, GrantAmount>
  comments: Record<string, GrantComment>
}) {
  const { projects, amounts, comments } = props
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 font-normal">
      {projects.map((project) => {
        const { granted, offered } = amounts[project.id]
        const comment = comments[project.id]
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
            <div
              className={clsx(
                'flex-1 [&>*]:h-full [&>*]:rounded-tl-none',
                comment && '[&>*]:rounded-b-none'
              )}
            >
              <ProjectCard project={project} />
            </div>
            {comment && (
              <Link
                href={comment.href}
                className="group flex items-center gap-2 rounded-b-md border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-gray-600 shadow-sm"
              >
                <Avatar
                  username={comment.author.username}
                  avatarUrl={comment.author.avatar_url}
                  id={comment.author.id}
                  size={5}
                  noLink
                />
                <span className="group-hover:underline">
                  {comment.author.full_name.split(' ')[0]}’s comment on the grant →
                </span>
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
